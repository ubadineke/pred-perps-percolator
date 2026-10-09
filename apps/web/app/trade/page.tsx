import { redirect } from "next/navigation";
import { getMarkets } from "@/lib/api";
import { isTradable } from "@/lib/markets";

export const dynamic = "force-dynamic";

/** "Trade" in the nav opens the first tradable market (or the market list when there is none). */
export default async function TradeIndex() {
  const markets = await getMarkets().catch(() => []);
  const target = markets.find(isTradable) ?? markets[0];
  redirect(target ? `/trade/${target.slug}` : "/markets");
}
