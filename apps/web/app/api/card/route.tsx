import { ImageResponse } from "next/og";
import { cardMetrics, cardPrice, parseShareCard, signedPct, signedUsd, type ShareCard } from "@/lib/share-card";

// 1200 x 675 is X's recommended 16:9 image size.
const W = 1200;
const H = 675;
const C = { cobalt: "#3d3bff", ink: "#0b1020", muted: "#4a5168", subtle: "#6b7289", canvas: "#f6f7fb", long: "#0a8f4f", short: "#e0392f" };

/** Satori needs TTF/OTF; Google Fonts serves TrueType to clients that send no browser user agent. */
async function googleFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}`, { cache: "force-cache" })).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url, { cache: "force-cache" })).arrayBuffer() : null;
  } catch {
    return null;
  }
}

let assets: Promise<{ fonts: { name: string; data: ArrayBuffer; weight: 500 | 600 | 800 }[]; logo: string; logoWhite: string; markWhite: string }> | undefined;
function loadAssets(origin: string) {
  assets ??= (async () => {
    const [mona500, mona800, mono600] = await Promise.all([googleFont("Mona Sans", 500), googleFont("Mona Sans", 800), googleFont("Geist Mono", 600)]);
    // public/ is served by the CDN, not bundled with the function, so fetch it from our own origin.
    const png = async (name: string) => `data:image/png;base64,${Buffer.from(await (await fetch(new URL(`/brand/${name}`, origin))).arrayBuffer()).toString("base64")}`;
    const [logo, logoWhite, markWhite] = await Promise.all([png("moxie-logo.png"), png("moxie-logo-white.png"), png("moxie-mark-white.png")]);
    const fonts = [
      mona500 && { name: "Mona Sans", data: mona500, weight: 500 as const },
      mona800 && { name: "Mona Sans", data: mona800, weight: 800 as const },
      mono600 && { name: "Geist Mono", data: mono600, weight: 600 as const },
    ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 500 | 600 | 800 }[];
    return { fonts, logo, logoWhite, markWhite };
  })();
  // Don't cache a failed load (e.g. a cold start that couldn't reach Google Fonts).
  assets.catch(() => (assets = undefined));
  return assets;
}

const MONO = { fontFamily: "Geist Mono", fontWeight: 600 } as const;
const LOGO_RATIO = 2609 / 836;

/** A two-point price line from entry to exit (no invented path in between). */
function PriceLine({ card, width, height, stroke }: { card: ShareCard; width: number; height: number; stroke: string }) {
  const lo = Math.min(card.entryCents, card.exitCents);
  const hi = Math.max(card.entryCents, card.exitCents);
  const span = Math.max(hi - lo, 1);
  const y = (c: number) => height - 18 - ((c - lo) / span) * (height - 36);
  const y1 = y(card.entryCents);
  const y2 = y(card.exitCents);
  const end = card.side === "long" ? (card.exitCents >= card.entryCents ? C.long : C.short) : card.exitCents <= card.entryCents ? C.long : C.short;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={`M 18 ${y1} C ${width * 0.45} ${y1}, ${width * 0.55} ${y2}, ${width - 18} ${y2} L ${width - 18} ${height} L 18 ${height} Z`} fill={stroke} fillOpacity={0.12} />
      <path d={`M 18 ${y1} C ${width * 0.45} ${y1}, ${width * 0.55} ${y2}, ${width - 18} ${y2}`} stroke={stroke} strokeWidth={5} fill="none" />
      <circle cx={18} cy={y1} r={9} fill={C.ink} />
      <circle cx={width - 18} cy={y2} r={10} fill={end} />
    </svg>
  );
}

function Receipt({ card, logo }: { card: ShareCard; logo: string }) {
  const { pnlUsd, roiPct } = cardMetrics(card);
  const tone = pnlUsd >= 0 ? C.long : C.short;
  return (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", background: "#fff", padding: "64px 72px", position: "relative", fontFamily: "Mona Sans", color: C.ink }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <img src={logo} height={40} width={40 * LOGO_RATIO} />
        <div style={{ ...MONO, fontSize: 20, color: C.subtle }}>{card.status === "closed" ? "Closed position" : "Open position"}</div>
      </div>
      <div style={{ marginTop: 44, fontSize: 30, fontWeight: 500, maxWidth: 560, lineHeight: 1.2 }}>{card.market}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 16 }}>
        <div style={{ display: "flex", height: 40, padding: "0 18px", alignItems: "center", borderRadius: 999, fontSize: 20, fontWeight: 800, background: card.side === "long" ? "rgba(10,143,79,.1)" : "rgba(224,57,47,.1)", color: card.side === "long" ? C.long : C.short }}>
          {card.side === "long" ? "▲ Long" : "▼ Short"}
        </div>
        <div style={{ ...MONO, fontSize: 20, color: C.subtle }}>{`${card.contracts.toLocaleString("en-US", { maximumFractionDigits: 2 })} contracts`}</div>
      </div>
      <div style={{ marginTop: 30, fontSize: 128, fontWeight: 800, letterSpacing: -6, color: tone, lineHeight: 1 }}>{signedUsd(pnlUsd)}</div>
      <div style={{ marginTop: 14, fontSize: 34, fontWeight: 800, color: tone }}>{`${signedPct(roiPct)} return`}</div>
      <div style={{ position: "absolute", right: 72, top: 190, display: "flex" }}>
        <PriceLine card={card} width={430} height={170} stroke={C.cobalt} />
      </div>
      <div style={{ position: "absolute", right: 72, bottom: 64, display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
        <div style={{ fontSize: 18, color: C.subtle }}>Entry</div>
        <div style={{ ...MONO, fontSize: 34, marginBottom: 12 }}>{cardPrice(card.entryCents)}</div>
        <div style={{ fontSize: 18, color: C.subtle }}>{card.status === "closed" ? "Exit" : "Now"}</div>
        <div style={{ ...MONO, fontSize: 34 }}>{cardPrice(card.exitCents)}</div>
      </div>
      <div style={{ position: "absolute", left: 72, bottom: 56, fontSize: 20, color: C.subtle }}>{`moxie.markets${card.handle ? ` · @${card.handle}` : ""}`}</div>
    </div>
  );
}

function Hero({ card, logoWhite, markWhite }: { card: ShareCard; logoWhite: string; markWhite: string }) {
  const { pnlUsd, roiPct } = cardMetrics(card);
  const headline = card.status === "closed" ? (pnlUsd >= 0 ? "I called it." : "Not this time.") : pnlUsd >= 0 ? "Calling it." : "Holding my call.";
  return (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", background: C.cobalt, color: "#fff", padding: "64px 72px", position: "relative", fontFamily: "Mona Sans" }}>
      <img src={markWhite} width={620} height={620} style={{ position: "absolute", right: -60, top: 27, opacity: 0.14 }} />
      <img src={logoWhite} height={40} width={40 * LOGO_RATIO} />
      <div style={{ marginTop: 56, fontSize: 34, fontWeight: 800, opacity: 0.9 }}>{headline}</div>
      <div style={{ fontSize: 210, fontWeight: 800, letterSpacing: -10, lineHeight: 0.95, marginTop: 6 }}>{signedPct(roiPct)}</div>
      <div style={{ display: "flex", marginTop: 26, fontSize: 26, fontWeight: 500, maxWidth: 1000 }}>
        {`${card.side === "long" ? "Long" : "Short"} ${card.market} · ${cardPrice(card.entryCents)} → ${cardPrice(card.exitCents)}`}
      </div>
      <div style={{ position: "absolute", left: 72, right: 72, bottom: 56, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 22 }}>
        <div style={{ ...MONO, display: "flex", height: 44, padding: "0 20px", alignItems: "center", borderRadius: 999, background: "#fff", color: C.cobalt, fontSize: 22 }}>{signedUsd(pnlUsd)}</div>
        <div>{`moxie.markets${card.handle ? ` · @${card.handle}` : ""}`}</div>
      </div>
    </div>
  );
}

function Brag({ card, logo }: { card: ShareCard; logo: string }) {
  const { pnlUsd } = cardMetrics(card);
  const short = card.side === "short";
  const first = short ? `Sold at ${cardPrice(card.entryCents).slice(0, -1)}.` : `Bought at ${cardPrice(card.entryCents).slice(0, -1)}.`;
  const verb = card.status === "open" ? "Now at" : short ? "Bought back at" : "Sold at";
  return (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", background: "#fff", padding: "64px 72px", position: "relative", fontFamily: "Mona Sans", color: C.ink }}>
      <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -5, color: C.subtle, lineHeight: 1 }}>{first}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 8, fontSize: 96, fontWeight: 800, letterSpacing: -5, lineHeight: 1 }}>
        <div>{verb}</div>
        <div style={{ background: C.cobalt, color: "#fff", padding: "0 10px" }}>{`${cardPrice(card.exitCents).slice(0, -1)}.`}</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 116, display: "flex" }}>
        <PriceLine card={card} width={W} height={240} stroke={C.cobalt} />
      </div>
      <div style={{ position: "absolute", left: 72, right: 72, bottom: 48, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: pnlUsd >= 0 ? C.long : C.short }}>{signedUsd(pnlUsd)}</div>
          <div style={{ fontSize: 22, color: C.subtle, maxWidth: 620 }}>{card.market}</div>
        </div>
        <img src={logo} height={40} width={40 * LOGO_RATIO} />
      </div>
    </div>
  );
}

export async function GET(request: Request) {
  const card = parseShareCard(new URL(request.url).searchParams);
  if (!card) return new Response("Invalid card parameters", { status: 400 });
  const { fonts, logo, logoWhite, markWhite } = await loadAssets(new URL(request.url).origin);
  const body = card.design === "receipt" ? <Receipt card={card} logo={logo} /> : card.design === "brag" ? <Brag card={card} logo={logo} /> : <Hero card={card} logoWhite={logoWhite} markWhite={markWhite} />;
  return new ImageResponse(body, {
    width: W,
    height: H,
    fonts,
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
