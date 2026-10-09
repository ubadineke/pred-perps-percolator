import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { PortfolioView } from "@/components/account/portfolio-view";
import { Container, PageHeader } from "@/components/ui/primitives";
import { getMarkets } from "@/lib/api";
import { getExecutionConfig } from "@/lib/execution";

export const metadata: Metadata = { title: "Portfolio" };
export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const markets = await getMarkets().catch(() => []);
  return (
    <AppShell>
      <Container className="pb-16">
        <PageHeader eyebrow="Portfolio" title="Your account" description="One collateral balance backs every position, across every market." />
        <PortfolioView config={getExecutionConfig()} markets={markets} />
      </Container>
    </AppShell>
  );
}
