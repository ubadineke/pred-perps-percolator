import { AppShell } from "@/components/app-shell";
import { Terminal } from "@/components/terminal";
import { getMarket,getMarkets } from "@/lib/api";

export default async function TradePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [market,markets]=await Promise.all([getMarket(slug),getMarkets()]);
  return <AppShell><Terminal market={market} markets={markets} /></AppShell>;
}
