import { decodeImportedMarket,decodePortfolioSummary } from "../../../packages/sdk/src/index.ts";
import { ProjectionStore,type EventProjection } from "./store.ts";
export type ChainAccount={address:string;owner:string;slot:number;data:Uint8Array};
export interface ChainSource{getImportedMarketAccounts():Promise<readonly ChainAccount[]>;getPortfolioAccounts():Promise<readonly ChainAccount[]>;getEvents(fromSlot:number,toSlot?:number):Promise<readonly EventProjection[]>;getSlot():Promise<number>}
export class MoxieIndexer{
 readonly source:ChainSource;readonly store:ProjectionStore;
 constructor(source:ChainSource,store=new ProjectionStore()){this.source=source;this.store=store}
 async sync(){const fromSlot=this.store.health.indexedSlot?this.store.health.indexedSlot+1:0;const [slot,markets,portfolios]=await Promise.all([this.source.getSlot(),this.source.getImportedMarketAccounts(),this.source.getPortfolioAccounts()]);
  for(const a of markets){const m=decodeImportedMarket(a.data);this.store.upsertMarket({address:a.address,providerMarketId:m.externalMarketHash,title:"",rules:m.rulesHash,slot:a.slot,assetIndex:m.assetIndex,marketId:m.marketId.toString(),status:m.status,markE6:m.markE6.toString(),indexE6:m.indexE6.toString(),closeTime:m.externalCloseTime.toString(),oracleUpdatedAt:m.lastSourceTimestamp.toString()})}
  for(const a of portfolios){const p=decodePortfolioSummary(a.data);this.store.upsertPortfolio({address:a.address,owner:p.ownerHex,slot:a.slot,capital:p.capital.toString(),pnl:p.pnl.toString(),health:{valid:p.health.valid,equity:p.health.equity.toString(),initialRequirement:p.health.initialRequirement.toString(),maintenanceRequirement:p.health.maintenanceRequirement.toString(),liquidationDeficit:p.health.liquidationDeficit.toString(),worstCaseLoss:p.health.worstCaseLoss.toString()},positions:p.positions.map(x=>({slot:x.slot,assetIndex:x.assetIndex,marketId:x.marketId.toString(),side:x.side===0?"long":"short",sizeQ:x.sizeQ.toString(),entryNotional:x.entryNotional.toString(),stale:x.stale}))})}
  for(const e of await this.source.getEvents(fromSlot,slot)){this.store.insertEvent(e);if(e.kind==="funding"||e.kind==="resolution")this.store.health.oracleLastSlot=Math.max(this.store.health.oracleLastSlot,e.slot);if(e.kind==="crank"||e.kind==="liquidation")this.store.health.keeperLastSlot=Math.max(this.store.health.keeperLastSlot,e.slot)}
  this.store.health.indexedSlot=Math.max(this.store.health.indexedSlot,slot);
 }
 async rebuild(){this.store.reset();await this.sync()}
}
