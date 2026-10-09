// Display formatting shared by every page. Prices are probabilities shown in cents (0–100¢);
// collateral is USDC with 6 decimals; contract sizes use 1_000_000 q per contract.

const USDC_DECIMALS = 1_000_000;
const Q_PER_CONTRACT = 1_000_000;

/** 49.7¢ */
export function cents(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}¢`;
}

/** Probability in E6 (e.g. 497000) → cents number (49.7). */
export function e6ToCents(e6: string | number | bigint): number {
  return Number(e6) / 10_000;
}

/** +1.2¢ / −0.4¢ — signed change in probability points. */
export function centsChange(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (value === 0) return "0.0¢";
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}¢`;
}

const usdFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdCompact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

/** $1,234.56 from a USD number. */
export function usd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return usdFormatter.format(value);
}

/** $1.2K — for listings where precision is noise. Zero renders as an em dash. */
export function usdShort(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value === 0) return "—";
  return value < 1_000 ? usdFormatter.format(value) : usdCompact.format(value);
}

/** USDC atoms (6 decimals) → USD number. */
export function atomsToUsd(atoms: string | number | bigint): number {
  return Number(atoms) / USDC_DECIMALS;
}

/** USD number → USDC atoms. */
export function usdToAtoms(value: number): bigint {
  return BigInt(Math.round(value * USDC_DECIMALS));
}

/** q units → contracts (number). */
export function qToContracts(q: string | number | bigint): number {
  return Number(q) / Q_PER_CONTRACT;
}

/** 12.5 contracts / 1,240 contracts */
export function contracts(value: number): string {
  const digits = Math.abs(value) >= 100 ? 0 : 2;
  return `${Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 })}`;
}

/** 7Kp1…3P2V */
export function shortAddress(address: string, chars = 4): string {
  if (!address) return "";
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

/** Time remaining until a unix-seconds timestamp: "2d 4h", "3h 12m", "8m", or "Closed". */
export function countdown(unixSeconds: string | number): string {
  const remaining = Number(unixSeconds) - Math.floor(Date.now() / 1000);
  if (!Number.isFinite(remaining)) return "—";
  if (remaining <= 0) return "Closed";
  const days = Math.floor(remaining / 86_400);
  const hours = Math.floor((remaining % 86_400) / 3_600);
  const minutes = Math.floor((remaining % 3_600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${Math.max(minutes, 1)}m`;
}

/** "just now", "4m ago", "2h ago", "3d ago" from unix seconds. */
export function timeAgo(unixSeconds: string | number): string {
  const elapsed = Math.floor(Date.now() / 1000) - Number(unixSeconds);
  if (!Number.isFinite(elapsed) || Number(unixSeconds) <= 0) return "—";
  if (elapsed < 45) return "just now";
  if (elapsed < 3_600) return `${Math.round(elapsed / 60)}m ago`;
  if (elapsed < 86_400) return `${Math.round(elapsed / 3_600)}h ago`;
  return `${Math.round(elapsed / 86_400)}d ago`;
}
