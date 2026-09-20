import { AppShell } from "@/components/app-shell";
import { Terminal } from "@/components/terminal";
import { getMarket } from "@/lib/markets";

export default async function TradePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <AppShell><Terminal market={getMarket(slug)} /></AppShell>;
}
