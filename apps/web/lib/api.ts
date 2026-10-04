import{toMarket,type ApiMarket,type Market}from"./markets";
const base=()=>process.env.MOXIE_API_URL??process.env.NEXT_PUBLIC_MOXIE_API_URL??"http://127.0.0.1:8787";
async function request<T>(path:string):Promise<T>{const response=await fetch(`${base()}${path}`,{cache:"no-store"});if(!response.ok)throw new Error(response.status===404?"The requested Moxie account was not indexed.":"The Moxie indexer is unavailable.");return response.json() as Promise<T>}
export async function getMarkets():Promise<Market[]>{return(await request<ApiMarket[]>("/v1/markets")).map(toMarket)}
export async function getMarket(address:string):Promise<Market>{return toMarket(await request<ApiMarket>(`/v1/markets/${encodeURIComponent(address)}`))}
export type ApiPosition={slot:number;assetIndex:number;marketId:string;side:"long"|"short";sizeQ:string;entryNotional:string;stale:boolean};
export type ApiPortfolio={address:string;owner:string;slot:number;capital:string;pnl:string;portfolioId:string;positionEpoch:string;sequence:string;health:{valid:boolean;equity:string;initialRequirement:string;maintenanceRequirement:string;liquidationDeficit:string;worstCaseLoss:string};positions:ApiPosition[]};
export const getPortfolio=(address:string)=>request<ApiPortfolio>(`/v1/portfolios/${encodeURIComponent(address)}`);
export const getPortfolioByOwner=(ownerHex:string)=>request<ApiPortfolio>(`/v1/owners/${encodeURIComponent(ownerHex)}/portfolio`);
export type ApiTrade={signature:string;instructionIndex:number;slot:number;kind:"trade";marketId?:string;portfolio?:string;data:Record<string,string>};
export type ApiPricePoint={slot:number;observedAt:string;markE6:string;indexE6:string;localMidE6:string;basisTwapE6:string};
export const getMarketTrades=(address:string)=>request<ApiTrade[]>(`/v1/markets/${encodeURIComponent(address)}/trades`);
export const getMarketPrices=(address:string)=>request<ApiPricePoint[]>(`/v1/markets/${encodeURIComponent(address)}/prices`);

export type ApiPantaMarket={
  provider:"panta";providerMarketId:string;category?:string;title:string;description:string;rules:string;
  closeTime:number;status:"open"|"locked"|"resolved"|"cancelled"|"unknown";indexPriceE6?:number;
  volumeUsdE6?:string;providerPhase?:string;valuationStatus?:string;sourceNetwork?:"solana-mainnet"|"solana-devnet"|"unknown";
  sourceUrl?:string;observedAt:number;
};
export type ApiProviderStatus={provider:"panta";network:"solana-mainnet";updatedAt:number;stale:boolean;error?:string};
export const getPantaMarkets=(limit=12)=>request<ApiPantaMarket[]>(`/v1/providers/panta/markets?limit=${limit}`);
export const getPantaStatus=()=>request<ApiProviderStatus>("/v1/providers/panta/status");
export const getPantaMarket=(id:string)=>request<ApiPantaMarket>(`/v1/providers/panta/markets/${encodeURIComponent(id)}`);
