export const IMPORTED_MARKET_RECORD_SIZE = 384;
const dv=(b:Uint8Array)=>new DataView(b.buffer,b.byteOffset,b.byteLength);
const hex=(b:Uint8Array,o:number,n:number)=>Buffer.from(b.subarray(o,o+n)).toString("hex");
export type ImportedMarketAccount={status:number;assetIndex:number;marketId:bigint;externalCloseTime:bigint;lastSourceTimestamp:bigint;sequence:bigint;markE6:bigint;indexE6:bigint;fundingPremiumE6:bigint;fundingUnitE6:bigint;externalMarketHash:string;rulesHash:string};
export const marketLifecycle=(status:number):"active"|"restricted"|"reduce-only"|"locked"|"resolved"=>{const x=["","active","restricted","reduce-only","locked","resolved"][status];if(!x)throw new Error("invalid market lifecycle");return x as any};
export function decodeImportedMarket(b:Uint8Array):ImportedMarketAccount{
 if(b.length!==384||dv(b).getBigUint64(0,true)!==0x4d4f5849454d4b54n||b[8]!==1)throw new Error("invalid imported market account");const v=dv(b);
 return{status:b[9],assetIndex:v.getUint16(10,true),externalMarketHash:hex(b,16,32),rulesHash:hex(b,144,32),externalCloseTime:v.getBigInt64(176,true),marketId:v.getBigUint64(184,true),lastSourceTimestamp:v.getBigInt64(256,true),sequence:v.getBigUint64(272,true),markE6:v.getBigUint64(280,true),indexE6:v.getBigUint64(288,true),fundingPremiumE6:v.getBigInt64(368,true),fundingUnitE6:v.getBigInt64(376,true)};
}
export type PortfolioPosition={slot:number;assetIndex:number;marketId:bigint;side:0|1;sizeQ:bigint;entryNotional:bigint;stale:boolean};
export type PortfolioHealth={valid:boolean;equity:bigint;initialRequirement:bigint;maintenanceRequirement:bigint;liquidationDeficit:bigint;worstCaseLoss:bigint};
export type PortfolioSummary={ownerHex:string;capital:bigint;pnl:bigint;fundingLongPaid:bigint;fundingLongReceived:bigint;fundingShortPaid:bigint;fundingShortReceived:bigint;portfolioId:bigint;sequence:bigint;positions:readonly PortfolioPosition[];health:PortfolioHealth};
const readU128=(v:DataView,o:number)=>v.getBigUint64(o,true)|(v.getBigUint64(o+8,true)<<64n);
const readI128=(v:DataView,o:number)=>{const x=readU128(v,o);return x&(1n<<127n)?x-(1n<<128n):x};
export function decodePortfolioSummary(b:Uint8Array):PortfolioSummary{
 if(b.length<9571)throw new Error("invalid portfolio account");const v=dv(b),base=16,capital=base+100+32,legs=356,legSize=139,healthAt=8852,positions:PortfolioPosition[]=[];
 for(let slot=0;slot<16;slot++){const o=legs+slot*legSize;if(b[o]===1)positions.push({slot,assetIndex:v.getUint32(o+1,true),marketId:v.getBigUint64(o+5,true),side:b[o+13] as 0|1,sizeQ:readI128(v,o+14),entryNotional:readU128(v,o+30),stale:b[o+138]===1})}
 const health={equity:readI128(v,healthAt),initialRequirement:readU128(v,healthAt+16),maintenanceRequirement:readU128(v,healthAt+32),liquidationDeficit:readU128(v,healthAt+48),worstCaseLoss:readU128(v,healthAt+64),valid:b[healthAt+120]===1};
 return{ownerHex:hex(b,base+100,32),capital:readU128(v,capital),pnl:readI128(v,capital+16),fundingLongPaid:readU128(v,capital+96),fundingLongReceived:readU128(v,capital+112),fundingShortPaid:readU128(v,capital+128),fundingShortReceived:readU128(v,capital+144),portfolioId:v.getBigUint64(9539,true),sequence:v.getBigUint64(9547,true),positions,health};
}
export const discoverActivePerps=<T extends ImportedMarketAccount>(markets:readonly T[])=>markets.filter(m=>m.status>=1&&m.status<5);
export const discoverTradablePerps=<T extends ImportedMarketAccount>(markets:readonly T[])=>markets.filter(m=>m.status===1||m.status===2);
