import { FEE_BPS, marginPerContract, type Side } from "../../../packages/sdk/src/trading";

/** The three PnL card designs a trader can share. */
export const CARD_DESIGNS = [
  { value: "receipt", label: "Receipt" },
  { value: "hero", label: "Cobalt" },
  { value: "brag", label: "Brag" },
] as const;
export type CardDesign = (typeof CARD_DESIGNS)[number]["value"];

/** Everything a card shows. Prices are cents per contract (0–100), as elsewhere in the app. */
export type ShareCard = {
  design: CardDesign;
  market: string;
  side: Side;
  contracts: number;
  entryCents: number;
  exitCents: number;
  /** "closed" uses the fill price; "open" marks the position at the current price. */
  status: "closed" | "open";
  handle?: string;
};

export type CardMetrics = { pnlUsd: number; roiPct: number; marginUsd: number };

/**
 * PnL after trading fees (entry and exit, FEE_BPS each) and return on the margin the position
 * locked. An open position is valued as if closed at the current price.
 */
export function cardMetrics(card: ShareCard): CardMetrics {
  const direction = card.side === "long" ? 1 : -1;
  const gross = (direction * card.contracts * (card.exitCents - card.entryCents)) / 100;
  const fees = (card.contracts * ((card.entryCents + card.exitCents) / 100) * Number(FEE_BPS)) / 10_000;
  const marginUsd = card.contracts * marginPerContract(card.side, card.entryCents / 100);
  const pnlUsd = gross - fees;
  return { pnlUsd, roiPct: marginUsd > 0 ? (pnlUsd / marginUsd) * 100 : 0, marginUsd };
}

const DESIGNS = new Set<string>(CARD_DESIGNS.map((d) => d.value));
const num = (value: string | null) => (value === null || value.trim() === "" ? Number.NaN : Number(value));

/** Reads a card from URL params; null when anything required is missing or out of range. */
export function parseShareCard(params: URLSearchParams): ShareCard | null {
  const design = params.get("d") ?? "hero";
  const side = params.get("s");
  const market = params.get("m")?.trim().slice(0, 120);
  const contracts = num(params.get("n"));
  const entryCents = num(params.get("e"));
  const exitCents = num(params.get("x"));
  const status = params.get("st") === "open" ? "open" : "closed";
  const handle = params.get("h")?.replace(/[^A-Za-z0-9_]/g, "").slice(0, 15) || undefined;
  const validPrice = (c: number) => Number.isFinite(c) && c > 0 && c < 100;
  if (!DESIGNS.has(design) || (side !== "long" && side !== "short") || !market) return null;
  if (!(contracts > 0) || !validPrice(entryCents) || !validPrice(exitCents)) return null;
  return { design: design as CardDesign, market, side, contracts, entryCents, exitCents, status, handle };
}

export function shareCardQuery(card: ShareCard): string {
  const q = new URLSearchParams({
    d: card.design,
    m: card.market,
    s: card.side,
    n: String(Math.round(card.contracts * 1_000_000) / 1_000_000),
    e: card.entryCents.toFixed(3),
    x: card.exitCents.toFixed(3),
    st: card.status,
  });
  if (card.handle) q.set("h", card.handle);
  return q.toString();
}

export const signedUsd = (value: number) => `${value >= 0 ? "+" : "−"}$${Math.abs(value).toFixed(2)}`;
export const signedPct = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;
export const cardPrice = (cents: number) => `$${(cents / 100).toFixed(3)}`;

/** The text that goes with the card on X. The card image itself comes from the share page preview. */
export function shareText(card: ShareCard): string {
  const { pnlUsd, roiPct } = cardMetrics(card);
  const side = card.side === "long" ? "Long" : "Short";
  const verb = card.status === "closed" ? (pnlUsd >= 0 ? "Called it" : "Took an L") : pnlUsd >= 0 ? "Up on my call" : "Holding my call";
  return `${verb} on Moxie: ${side} "${card.market}" ${signedUsd(pnlUsd)} (${signedPct(roiPct)}).`;
}

export function xIntentUrl(card: ShareCard, shareUrl: string): string {
  return `https://x.com/intent/post?${new URLSearchParams({ text: shareText(card), url: shareUrl })}`;
}
