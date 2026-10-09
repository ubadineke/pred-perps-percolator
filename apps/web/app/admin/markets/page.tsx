import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { AdminMarketConsole } from "@/components/admin-market-console";
import { Alert, Container, PageHeader } from "@/components/ui/primitives";
import { getMarkets, getPantaMarkets } from "@/lib/api";

export const metadata: Metadata = { title: "Market admission" };
export const dynamic = "force-dynamic";

export default async function AdminMarketsPage() {
  const [providerResult, activeResult] = await Promise.allSettled([getPantaMarkets(50), getMarkets()]);
  const markets = providerResult.status === "fulfilled" ? providerResult.value : [];
  const active = activeResult.status === "fulfilled" ? activeResult.value : [];
  const nextMarketId = active.reduce((max, market) => Math.max(max, Number(market.marketId)), 0) + 1;
  const nextAssetIndex = active.reduce((max, market) => Math.max(max, market.assetIndex), -1) + 1;
  const config = {
    adminAddress: process.env.MOXIE_MARKET_AUTHORITY ?? "",
    marketAccount: process.env.MOXIE_MARKET_ACCOUNT ?? "",
    oracleProgramId: process.env.MOXIE_ORACLE_PROGRAM_ID ?? "",
    percolatorProgramId: process.env.PERCOLATOR_PROGRAM_ID ?? "",
    nextAssetIndex,
    nextMarketId: String(nextMarketId),
    cluster: process.env.MOXIE_CLUSTER ?? "devnet",
  };

  return (
    <AppShell>
      <Container className="pb-16">
        <PageHeader
          eyebrow="Admin · Market authority"
          title="Market admission"
          description="Review external events and activate them as Moxie markets. Every activation is signed by the market authority and enforced on-chain."
        />
        {providerResult.status === "rejected" ? (
          <Alert tone="error" title="Provider catalog unavailable">Restart the indexer or check the server-side Panta key.</Alert>
        ) : (
          <AdminMarketConsole markets={markets} config={config} />
        )}
      </Container>
    </AppShell>
  );
}
