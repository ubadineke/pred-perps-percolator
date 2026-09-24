import{toMarket,type ApiMarket,type Market}from"./markets";
const base=()=>process.env.MOXIE_API_URL??process.env.NEXT_PUBLIC_MOXIE_API_URL??"http://127.0.0.1:8787";
async function request<T>(path:string):Promise<T>{const response=await fetch(`${base()}${path}`,{cache:"no-store"});if(!response.ok)throw new Error(response.status===404?"The requested Moxie account was not indexed.":"The Moxie indexer is unavailable.");return response.json() as Promise<T>}
export async function getMarkets():Promise<Market[]>{return(await request<ApiMarket[]>("/v1/markets")).map(toMarket)}
export async function getMarket(address:string):Promise<Market>{return toMarket(await request<ApiMarket>(`/v1/markets/${encodeURIComponent(address)}`))}
export type ApiPosition={slot:number;assetIndex:number;marketId:string;side:"long"|"short";sizeQ:string;entryNotional:string;stale:boolean};
export type ApiPortfolio={address:string;owner:string;slot:number;capital:string;pnl:string;health:{valid:boolean;equity:string;initialRequirement:string;maintenanceRequirement:string;liquidationDeficit:string;worstCaseLoss:string};positions:ApiPosition[]};
export const getPortfolio=(address:string)=>request<ApiPortfolio>(`/v1/portfolios/${encodeURIComponent(address)}`);
