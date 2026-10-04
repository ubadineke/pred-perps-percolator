import { decodeImportedMarket,decodePortfolioSummary } from "../../../packages/sdk/src/index.ts";
import { ProjectionStore,type EventProjection } from "./store.ts";
import {createHash} from "node:crypto";
export type ChainAccount={address:string;owner:string;slot:number;data:Uint8Array};
export interface ChainSource{getImportedMarketAccounts():Promise<readonly ChainAccount[]>;getPortfolioAccounts():Promise<readonly ChainAccount[]>;getEvents(fromSlot:number,toSlot?:number):Promise<readonly EventProjection[]>;getSlot():Promise<number>}
export type MarketMetadata={providerMarketId:string;title:string;rules?:string;provider?:string};
export class MoxieIndexer{
 readonly source:ChainSource;readonly store:ProjectionStore;readonly metadata:Map<string,MarketMetadata>;
 constructor(source:ChainSource,store=new ProjectionStore(),metadata:readonly MarketMetadata[]=[]){this.source=source;this.store=store;this.metadata=new Map(metadata.map(x=>[createHash("sha256").update(x.providerMarketId).digest("hex"),x]))}
 async sync(){
  // Confirmed transactions can become available through getTransaction shortly after the
  // cluster slot has advanced. Rescan a bounded overlap and rely on the event key for
  // idempotency so late-visible fills are not skipped permanently.
  const fromSlot=this.store.health.indexedSlot?Math.max(0,this.store.health.indexedSlot-4_096):0;const [slot,markets,portfolios]=await Promise.all([this.source.getSlot(),this.source.getImportedMarketAccounts(),this.source.getPortfolioAccounts()]);
  for(const a of markets){const m=decodeImportedMarket(a.data);const meta=this.metadata.get(m.externalMarketHash);this.store.upsertMarket({address:a.address,provider:meta?.provider?.toLowerCase()??"unknown",providerMarketId:meta?.providerMarketId??m.externalMarketHash,title:meta?.title??"",rules:meta?.rules??m.rulesHash,slot:a.slot,assetIndex:m.assetIndex,marketId:m.marketId.toString(),status:m.status,markE6:m.markE6.toString(),indexE6:m.indexE6.toString(),localBidE6:m.localBidE6.toString(),localAskE6:m.localAskE6.toString(),basisTwapE6:m.basisTwapE6.toString(),closeTime:m.externalCloseTime.toString(),oracleUpdatedAt:m.lastSourceTimestamp.toString()})}
  for(const a of portfolios){const p=decodePortfolioSummary(a.data);this.store.upsertPortfolio({address:a.address,owner:p.ownerHex,slot:a.slot,capital:p.capital.toString(),pnl:p.pnl.toString(),portfolioId:p.portfolioId.toString(),positionEpoch:p.positionEpoch.toString(),sequence:p.sequence.toString(),health:{valid:p.health.valid,equity:p.health.equity.toString(),initialRequirement:p.health.initialRequirement.toString(),maintenanceRequirement:p.health.maintenanceRequirement.toString(),liquidationDeficit:p.health.liquidationDeficit.toString(),worstCaseLoss:p.health.worstCaseLoss.toString()},positions:p.positions.map(x=>({slot:x.slot,assetIndex:x.assetIndex,marketId:x.marketId.toString(),side:x.side===0?"long":"short",sizeQ:x.sizeQ.toString(),entryNotional:x.entryNotional.toString(),stale:x.stale}))})}
  for(const e of await this.source.getEvents(fromSlot,slot)){this.store.insertEvent(e);if(e.kind==="funding"||e.kind==="resolution")this.store.health.oracleLastSlot=Math.max(this.store.health.oracleLastSlot,e.slot);if(e.kind==="crank"||e.kind==="liquidation")this.store.health.keeperLastSlot=Math.max(this.store.health.keeperLastSlot,e.slot)}
  this.store.health.indexedSlot=Math.max(this.store.health.indexedSlot,slot);
 }
 async rebuild(){this.store.reset();await this.sync()}
}
