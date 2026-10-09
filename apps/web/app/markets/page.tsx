import type { Metadata } from "next";
import { Database } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MarketExplorer } from "@/components/market-explorer";
import { PantaMarketGrid } from "@/components/panta-market-grid";
import { Alert, Container, EmptyState, PageHeader, Stat } from "@/components/ui/primitives";
import { getMarkets, getPantaMarkets, getPantaStatus } from "@/lib/api";
import { usdShort } from "@/lib/format";

export const metadata: Metadata = { title: "Markets" };
export const dynamic = "force-dynamic";

export default async function MarketsPage() {
  const [marketsResult, pantaResult, statusResult] = await Promise.allSettled([getMarkets(), getPantaMarkets(), getPantaStatus()]);
  const markets = marketsResult.status === "fulfilled" ? marketsResult.value : [];
  const pantaMarkets = pantaResult.status === "fulfilled" ? pantaResult.value : [];
  const pantaStatus = statusResult.status === "fulfilled" ? statusResult.value : undefined;
  const volume = markets.reduce((sum, market) => sum + market.stats.volume24hUsd, 0);
  const openInterest = markets.reduce((sum, market) => sum + market.stats.openInterestUsd, 0);

  return (
    <AppShell>
      <Container className="pb-16">
        <PageHeader
          eyebrow="Markets"
          title="Trade the probability"
          description="Go long or short on how likely an event is — and exit any time before it resolves."
          actions={
            <dl className="grid grid-cols-3 gap-8">
              <Stat label="Markets" value={markets.length} />
              <Stat label="24h volume" value={usdShort(volume)} />
              <Stat label="Open interest" value={usdShort(openInterest)} />
            </dl>
          }
        />
        <div className="space-y-14">
          {marketsResult.status === "rejected" ? (
            <Alert tone="error" title="Markets are unavailable">The market data service isn’t responding. Refresh in a moment.</Alert>
          ) : markets.length ? (
            <MarketExplorer markets={markets} />
          ) : (
            <div className="rounded-lg border border-border">
              <EmptyState icon={<Database />} title="No tradable markets yet" description="New markets appear here as soon as they’re admitted." />
            </div>
          )}
          {pantaResult.status === "rejected" ? (
            <Alert title="Source markets unavailable">Panta’s catalog couldn’t be loaded. Moxie markets above are unaffected.</Alert>
          ) : (
            <PantaMarketGrid markets={pantaMarkets} status={pantaStatus} />
          )}
        </div>
      </Container>
    </AppShell>
  );
}
