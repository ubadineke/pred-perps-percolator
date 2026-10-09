import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TradeTerminal } from "@/components/trade/trade-terminal";
import { getMarket, getMarkets, NotIndexedError } from "@/lib/api";
import { getExecutionConfig } from "@/lib/execution";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  try {
    return await Promise.all([getMarket(slug), getMarkets()]);
  } catch (cause) {
    if (cause instanceof NotIndexedError) notFound();
    throw cause;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const market = await getMarket(slug).catch(() => null);
  return { title: market?.question ?? "Trade" };
}

export default async function TradePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [market, markets] = await load(slug);
  return (
    <AppShell bare>
      <TradeTerminal market={market} markets={markets} config={getExecutionConfig()} />
    </AppShell>
  );
}
