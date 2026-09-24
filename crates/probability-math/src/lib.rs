#![no_std]

pub const PRICE_SCALE_E6: u64 = 1_000_000;
pub const BPS_SCALE: u64 = 10_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum OracleHealth {
    Healthy = 1,
    Degraded = 2,
    Stale = 3,
    Locked = 4,
    Resolved = 5,
}

impl TryFrom<u8> for OracleHealth {
    type Error = ();

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            1 => Ok(Self::Healthy),
            2 => Ok(Self::Degraded),
            3 => Ok(Self::Stale),
            4 => Ok(Self::Locked),
            5 => Ok(Self::Resolved),
            _ => Err(()),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct MarkPolicy {
    pub epsilon_e6: u64,
    pub local_weight_bps: u32,
    pub basis_ema_alpha_bps: u32,
    pub max_basis_e6: u64,
    pub max_mark_deviation_e6: u64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct MarkResult {
    pub mark_e6: u64,
    pub basis_ema_e6: i64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u8)]
pub enum MarketLifecycle {
    Active = 1,
    Restricted = 2,
    ReduceOnly = 3,
    Locked = 4,
    Resolved = 5,
}

impl TryFrom<u8> for MarketLifecycle {
    type Error = ();

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            1 => Ok(Self::Active),
            2 => Ok(Self::Restricted),
            3 => Ok(Self::ReduceOnly),
            4 => Ok(Self::Locked),
            5 => Ok(Self::Resolved),
            _ => Err(()),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct LifecyclePolicy {
    pub restricted_at: i64,
    pub reduce_only_at: i64,
    pub hard_flat_at: i64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct BinaryMarginPolicy {
    pub jump_buffer_e6: u64,
    pub liquidity_buffer_e6: u64,
    pub oracle_buffer_e6: u64,
    pub liquidation_buffer_e6: u64,
    pub fee_buffer_e6: u64,
    pub safety_buffer_e6: u64,
    pub maintenance_bps: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct BinaryMargin {
    pub initial_atoms: u128,
    pub maintenance_atoms: u128,
    pub terminal_loss_atoms: u128,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct FundingPolicy {
    pub coefficient_bps: u32,
    pub premium_cap_e6: u64,
    pub rate_cap_e6: u64,
    pub boundary_start_e6: u64,
    pub boundary_min_cap_e6: u64,
}

pub fn lifecycle_for_time(policy: &LifecyclePolicy, now: i64) -> Option<MarketLifecycle> {
    if policy.restricted_at <= 0
        || policy.restricted_at >= policy.reduce_only_at
        || policy.reduce_only_at >= policy.hard_flat_at
    {
        return None;
    }
    Some(if now >= policy.hard_flat_at {
        MarketLifecycle::Locked
    } else if now >= policy.reduce_only_at {
        MarketLifecycle::ReduceOnly
    } else if now >= policy.restricted_at {
        MarketLifecycle::Restricted
    } else {
        MarketLifecycle::Active
    })
}

pub fn transition_is_monotonic(current: MarketLifecycle, next: MarketLifecycle) -> bool {
    next >= current && current != MarketLifecycle::Resolved
}

pub fn is_reduce_only_delta(current: i128, delta: i128) -> bool {
    current
        .checked_add(delta)
        .map(|next| next.unsigned_abs() <= current.unsigned_abs())
        .unwrap_or(false)
}

/// Binary margin in settlement atoms. Quantity and price use e6 fixed-point scales.
/// Every division rounds toward greater collateralization.
pub fn binary_margin_requirement(
    signed_quantity: i128,
    mark_e6: u64,
    policy: &BinaryMarginPolicy,
) -> Option<BinaryMargin> {
    if signed_quantity == 0
        || mark_e6 > PRICE_SCALE_E6
        || policy.maintenance_bps > BPS_SCALE as u32
    {
        return None;
    }
    let quantity = signed_quantity.unsigned_abs();
    let adverse_e6 = if signed_quantity > 0 {
        mark_e6
    } else {
        PRICE_SCALE_E6.checked_sub(mark_e6)?
    };
    let terminal = mul_div_ceil(
        quantity,
        u128::from(adverse_e6),
        u128::from(PRICE_SCALE_E6),
    )?;
    let buffers_e6 = policy
        .jump_buffer_e6
        .checked_add(policy.liquidity_buffer_e6)?
        .checked_add(policy.oracle_buffer_e6)?
        .checked_add(policy.liquidation_buffer_e6)?
        .checked_add(policy.fee_buffer_e6)?
        .checked_add(policy.safety_buffer_e6)?;
    let buffers = mul_div_ceil(
        quantity,
        u128::from(buffers_e6),
        u128::from(PRICE_SCALE_E6),
    )?;
    let initial = terminal.checked_add(buffers)?;
    let maintenance = mul_div_ceil(
        initial,
        u128::from(policy.maintenance_bps),
        u128::from(BPS_SCALE),
    )?;
    Some(BinaryMargin {
        initial_atoms: initial,
        maintenance_atoms: maintenance,
        terminal_loss_atoms: terminal,
    })
}

/// Absolute probability-point premium from meaningful local impact prices.
pub fn funding_premium_e6(local_bid_e6: u64, local_ask_e6: u64, index_e6: u64) -> Option<i64> {
    if local_bid_e6 > local_ask_e6 || index_e6 > PRICE_SCALE_E6 {
        return None;
    }
    let rich = local_bid_e6.saturating_sub(index_e6);
    let cheap = index_e6.saturating_sub(local_ask_e6);
    i64::try_from(rich).ok()?.checked_sub(i64::try_from(cheap).ok()?)
}

/// Funding per contract in probability e6. Positive means longs pay shorts.
pub fn bounded_funding_unit_e6(
    premium_e6: i64,
    index_e6: u64,
    policy: &FundingPolicy,
) -> Option<i64> {
    if policy.coefficient_bps > BPS_SCALE as u32
        || policy.boundary_start_e6 >= PRICE_SCALE_E6 / 2
        || policy.boundary_min_cap_e6 > policy.rate_cap_e6
        || index_e6 > PRICE_SCALE_E6
    {
        return None;
    }
    let premium = premium_e6.clamp(
        -i64::try_from(policy.premium_cap_e6).ok()?,
        i64::try_from(policy.premium_cap_e6).ok()?,
    );
    let raw = i128::from(premium)
        .checked_mul(i128::from(policy.coefficient_bps))?
        .checked_div(i128::from(BPS_SCALE))?;
    let distance = index_e6.min(PRICE_SCALE_E6.checked_sub(index_e6)?);
    let cap = if distance >= policy.boundary_start_e6 {
        policy.rate_cap_e6
    } else if policy.boundary_start_e6 == 0 {
        policy.boundary_min_cap_e6
    } else {
        let range = policy.rate_cap_e6.checked_sub(policy.boundary_min_cap_e6)?;
        let scaled = mul_div_floor(
            u128::from(range),
            u128::from(distance),
            u128::from(policy.boundary_start_e6),
        )?;
        policy
            .boundary_min_cap_e6
            .checked_add(u64::try_from(scaled).ok()?)?
    };
    i64::try_from(raw.clamp(-i128::from(cap), i128::from(cap))).ok()
}

pub fn valid_live_price(price_e6: u64, epsilon_e6: u64) -> bool {
    epsilon_e6 > 0
        && epsilon_e6 < PRICE_SCALE_E6 / 2
        && price_e6 >= epsilon_e6
        && price_e6 <= PRICE_SCALE_E6 - epsilon_e6
}

pub fn midpoint_floor(left_e6: u64, right_e6: u64) -> Option<u64> {
    left_e6.checked_add(right_e6)?.checked_div(2)
}

pub fn mul_div_floor(value: u128, numerator: u128, denominator: u128) -> Option<u128> {
    if denominator == 0 {
        return None;
    }
    value.checked_mul(numerator)?.checked_div(denominator)
}

pub fn mul_div_ceil(value: u128, numerator: u128, denominator: u128) -> Option<u128> {
    if denominator == 0 {
        return None;
    }
    let product = value.checked_mul(numerator)?;
    product
        .checked_add(denominator.checked_sub(1)?)?
        .checked_div(denominator)
}

pub fn compute_mark(
    policy: &MarkPolicy,
    index_e6: u64,
    local_impact_bid_e6: u64,
    local_impact_ask_e6: u64,
    previous_basis_ema_e6: i64,
    health: OracleHealth,
) -> Option<MarkResult> {
    if policy.local_weight_bps > BPS_SCALE as u32
        || policy.basis_ema_alpha_bps > BPS_SCALE as u32
        || !valid_live_price(index_e6, policy.epsilon_e6)
        || !valid_live_price(local_impact_bid_e6, policy.epsilon_e6)
        || !valid_live_price(local_impact_ask_e6, policy.epsilon_e6)
        || local_impact_bid_e6 > local_impact_ask_e6
        || matches!(
            health,
            OracleHealth::Stale | OracleHealth::Locked | OracleHealth::Resolved
        )
    {
        return None;
    }

    let local_mid = midpoint_floor(local_impact_bid_e6, local_impact_ask_e6)?;
    let basis = i128::from(local_mid) - i128::from(index_e6);
    let previous = i128::from(previous_basis_ema_e6);
    let alpha = i128::from(policy.basis_ema_alpha_bps);
    let ema = previous
        .checked_mul(i128::from(BPS_SCALE).checked_sub(alpha)?)?
        .checked_add(basis.checked_mul(alpha)?)?
        .checked_div(i128::from(BPS_SCALE))?;
    let bounded_basis = ema.clamp(
        -i128::from(policy.max_basis_e6),
        i128::from(policy.max_basis_e6),
    );
    let health_weight_bps = match health {
        OracleHealth::Healthy => u64::from(policy.local_weight_bps),
        OracleHealth::Degraded => u64::from(policy.local_weight_bps) / 2,
        _ => return None,
    };
    let contribution = bounded_basis
        .checked_mul(i128::from(health_weight_bps))?
        .checked_div(i128::from(BPS_SCALE))?;
    let candidate = i128::from(index_e6).checked_add(contribution)?;
    let lower = index_e6.saturating_sub(policy.max_mark_deviation_e6);
    let upper = index_e6.saturating_add(policy.max_mark_deviation_e6);
    let live_lower = policy.epsilon_e6;
    let live_upper = PRICE_SCALE_E6.checked_sub(policy.epsilon_e6)?;
    let mark = candidate.clamp(
        i128::from(lower.max(live_lower)),
        i128::from(upper.min(live_upper)),
    );

    Some(MarkResult {
        mark_e6: u64::try_from(mark).ok()?,
        basis_ema_e6: i64::try_from(ema).ok()?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn policy() -> MarkPolicy {
        MarkPolicy {
            epsilon_e6: 1_000,
            local_weight_bps: 5_000,
            basis_ema_alpha_bps: 5_000,
            max_basis_e6: 20_000,
            max_mark_deviation_e6: 15_000,
        }
    }

    #[test]
    fn mark_is_index_anchored_and_deviation_bounded() {
        let result = compute_mark(
            &policy(),
            600_000,
            640_000,
            660_000,
            0,
            OracleHealth::Healthy,
        )
        .unwrap();
        assert_eq!(result.basis_ema_e6, 25_000);
        assert_eq!(result.mark_e6, 610_000);
        assert!(result.mark_e6.abs_diff(600_000) <= 15_000);
    }

    #[test]
    fn degraded_health_reduces_local_influence() {
        let healthy = compute_mark(
            &policy(),
            600_000,
            620_000,
            640_000,
            0,
            OracleHealth::Healthy,
        )
        .unwrap();
        let degraded = compute_mark(
            &policy(),
            600_000,
            620_000,
            640_000,
            0,
            OracleHealth::Degraded,
        )
        .unwrap();
        assert!(degraded.mark_e6 < healthy.mark_e6);
    }

    #[test]
    fn stale_and_invalid_inputs_fail_closed() {
        assert!(
            compute_mark(&policy(), 600_000, 590_000, 610_000, 0, OracleHealth::Stale).is_none()
        );
        assert!(compute_mark(
            &policy(),
            600_000,
            620_000,
            610_000,
            0,
            OracleHealth::Healthy
        )
        .is_none());
        assert!(!valid_live_price(0, 1_000));
        assert!(!valid_live_price(1_000_000, 1_000));
    }

    #[test]
    fn conservative_rounding_helpers_are_explicit() {
        assert_eq!(mul_div_floor(10, 1, 3), Some(3));
        assert_eq!(mul_div_ceil(10, 1, 3), Some(4));
        assert_eq!(midpoint_floor(1, 2), Some(1));
    }

    #[test]
    fn binary_margin_is_directional_and_conservative() {
        let p = BinaryMarginPolicy {
            jump_buffer_e6: 20_000,
            liquidity_buffer_e6: 10_000,
            oracle_buffer_e6: 5_000,
            liquidation_buffer_e6: 5_000,
            fee_buffer_e6: 1_000,
            safety_buffer_e6: 9_000,
            maintenance_bps: 8_000,
        };
        let long = binary_margin_requirement(1_000_000, 800_000, &p).unwrap();
        let short = binary_margin_requirement(-1_000_000, 800_000, &p).unwrap();
        assert_eq!(long.terminal_loss_atoms, 800_000);
        assert_eq!(short.terminal_loss_atoms, 200_000);
        assert_eq!(long.initial_atoms, 850_000);
        assert_eq!(short.initial_atoms, 250_000);
        assert_eq!(long.maintenance_atoms, 680_000);
    }

    #[test]
    fn lifecycle_is_ordered_and_reduce_only_is_exact() {
        let p = LifecyclePolicy {
            restricted_at: 100,
            reduce_only_at: 200,
            hard_flat_at: 300,
        };
        assert_eq!(lifecycle_for_time(&p, 99), Some(MarketLifecycle::Active));
        assert_eq!(lifecycle_for_time(&p, 100), Some(MarketLifecycle::Restricted));
        assert_eq!(lifecycle_for_time(&p, 200), Some(MarketLifecycle::ReduceOnly));
        assert_eq!(lifecycle_for_time(&p, 300), Some(MarketLifecycle::Locked));
        assert!(is_reduce_only_delta(100, -40));
        assert!(!is_reduce_only_delta(100, 1));
        assert!(!is_reduce_only_delta(0, 1));
        assert!(transition_is_monotonic(MarketLifecycle::Active, MarketLifecycle::Locked));
        assert!(!transition_is_monotonic(MarketLifecycle::Locked, MarketLifecycle::Active));
    }

    #[test]
    fn funding_uses_absolute_points_and_compresses_at_boundaries() {
        let p = FundingPolicy {
            coefficient_bps: 1_000,
            premium_cap_e6: 50_000,
            rate_cap_e6: 5_000,
            boundary_start_e6: 150_000,
            boundary_min_cap_e6: 500,
        };
        assert_eq!(funding_premium_e6(708_000, 716_000, 700_000), Some(8_000));
        assert_eq!(bounded_funding_unit_e6(8_000, 700_000, &p), Some(800));
        assert_eq!(bounded_funding_unit_e6(50_000, 10_000, &p), Some(800));
        assert_eq!(bounded_funding_unit_e6(-8_000, 700_000, &p), Some(-800));
    }
}
