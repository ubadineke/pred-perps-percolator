import { AppShell } from "@/components/app-shell";
import { Terminal } from "@/components/terminal";
import { getMarket,getMarkets } from "@/lib/api";

export default async function TradePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [market,markets]=await Promise.all([getMarket(slug),getMarkets()]);
  const execution={cluster:process.env.MOXIE_CLUSTER??"devnet",percolatorProgramId:process.env.PERCOLATOR_PROGRAM_ID??"",marketAccount:process.env.MOXIE_MARKET_ACCOUNT??"",usdcMint:process.env.MOXIE_USDC_MINT??"",collateralVault:process.env.MOXIE_COLLATERAL_VAULT??"",lpPortfolio:process.env.MOXIE_LP_PORTFOLIO??"",matcherProgramId:process.env.MOXIE_MATCHER_PROGRAM_ID??"",matcherContext:process.env.MOXIE_MATCHER_CONTEXT??"",matcherDelegate:process.env.MOXIE_MATCHER_DELEGATE??"",portfolioAccountSize:9563,maxLeverage:1};
  return <AppShell><Terminal market={market} markets={markets} execution={execution} /></AppShell>;
}
