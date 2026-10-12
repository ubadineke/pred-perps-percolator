import type { ApiPantaMarket } from "./api";
import type { Market } from "./markets";

// Whether a source market can become a Moxie perp. The admin console enforces the same checks
// before activation; this module is the single source of those rules.

/** A source market needs at least this long until it closes to be listed. */
export const MIN_MINUTES_TO_CLOSE = 15;

export type EligibilityKey = "live" | "eligible" | "no-price" | "closing" | "no-rules" | "closed";

export type Eligibility = {
  key: EligibilityKey;
  label: string;
  tone: "long" | "signal" | "warning" | "neutral";
  reason: string;
  /** The Moxie market for this source market, when one is live. */
  market?: Market;
};

const hasValidPrice = (m: Pick<ApiPantaMarket, "indexPriceE6">) => m.indexPriceE6 !== undefined && m.indexPriceE6 > 0 && m.indexPriceE6 < 1_000_000;

/** True when a source market passes Moxie's listing checks (ignoring whether it is already listed). */
export function isListable(m: ApiPantaMarket, now = Date.now()): boolean {
  return m.status === "open" && m.closeTime > now + MIN_MINUTES_TO_CLOSE * 60_000 && hasValidPrice(m) && Boolean(m.rules.trim());
}

export function sourceEligibility(m: ApiPantaMarket, moxieMarkets: readonly Market[], now = Date.now()): Eligibility {
  const market = moxieMarkets.find((x) => x.providerMarketId === m.providerMarketId && x.status !== 5);
  if (market) return { key: "live", label: "Perp live", tone: "long", reason: "Tradable on Moxie now.", market };
  if (m.status !== "open" || m.closeTime <= now) return { key: "closed", label: "Closed", tone: "neutral", reason: "This event has closed on the source market." };
  if (!hasValidPrice(m))
    return { key: "no-price", label: "No price yet", tone: "neutral", reason: "The source market hasn’t published a tradable price yet, so Moxie can’t track it." };
  if (m.closeTime <= now + MIN_MINUTES_TO_CLOSE * 60_000)
    return { key: "closing", label: "Too close to close", tone: "warning", reason: `Closes in under ${MIN_MINUTES_TO_CLOSE} minutes, too soon to list.` };
  if (!m.rules.trim()) return { key: "no-rules", label: "No rules", tone: "warning", reason: "The source market has no resolution rules to bind a perp to." };
  return { key: "eligible", label: "Eligible", tone: "signal", reason: "Meets Moxie’s listing checks. New perps are reviewed and listed by the Moxie team." };
}

/** Source markets still open for trading, soonest close first. */
export function liveSourceMarkets(markets: readonly ApiPantaMarket[], now = Date.now()): ApiPantaMarket[] {
  return markets.filter((m) => m.status === "open" && m.closeTime > now).sort((a, b) => a.closeTime - b.closeTime);
}
