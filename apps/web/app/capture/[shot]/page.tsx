import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { CaptureView, type CaptureShot } from "@/components/docs/capture-view";
import { getMarkets } from "@/lib/api";
import { getExecutionConfig } from "@/lib/execution";
import { isTradable, type Market } from "@/lib/markets";

// Renders documentation screenshots with sample account data (scripts/capture-docs-screenshots.mjs).
// Development only, or when MOXIE_DOCS_CAPTURE=1; production returns 404.

export const metadata: Metadata = { title: "Capture", robots: { index: false } };
export const dynamic = "force-dynamic";

const SHOTS: CaptureShot[] = ["ticket-create", "ticket-fund", "terminal-trading", "portfolio", "market-info", "markets"];

/**
 * `?demo=1`: present the indexed markets as open, with future close times and a fresh source price,
 * for product demo footage when the devnet markets' events have already closed.
 */
function asDemoMarkets(markets: Market[]): Market[] {
  const now = Math.floor(Date.now() / 1000);
  return markets.map((m, i) => {
    const closeTime = now + (i === 0 ? 2 * 86_400 + 4 * 3_600 : 86_400 + 9 * 3_600);
    return {
      ...m,
      status: 1,
      lifecycle: "Active",
      closeTime,
      indexStale: false,
      oracleUpdatedAt: now - 40,
      schedule: { restrictedAt: closeTime - 1_800, reduceOnlyAt: closeTime - 600, hardFlatAt: closeTime - 60 },
    };
  });
}

export default async function CapturePage({ params, searchParams }: { params: Promise<{ shot: string }>; searchParams: Promise<{ demo?: string }> }) {
  if (process.env.NODE_ENV === "production" && process.env.MOXIE_DOCS_CAPTURE !== "1") notFound();
  const { shot } = await params;
  if (!SHOTS.includes(shot as CaptureShot)) notFound();
  const { demo } = await searchParams;
  const indexed = await getMarkets();
  const markets = demo === "1" ? asDemoMarkets(indexed) : indexed;
  const market = markets.find(isTradable) ?? markets[0];
  if (!market) notFound();
  const withHeader = shot === "terminal-trading" || shot === "portfolio" || shot === "markets";
  return (
    <div className="min-h-dvh">
      {withHeader ? <SiteHeader cluster={process.env.MOXIE_CLUSTER ?? "devnet"} sampleAddress="D3AsxZ1H6sYJ4JPcXdo1XJMed3zJydnZ6JMbj4hN3P2V" /> : null}
      <CaptureView shot={shot as CaptureShot} market={market} markets={markets} config={getExecutionConfig()} />
    </div>
  );
}
