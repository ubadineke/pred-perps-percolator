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
}
