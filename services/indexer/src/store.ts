export type MarketProjection={address:string;provider:string;providerMarketId:string;title:string;rules:string;slot:number;assetIndex:number;marketId:string;status:number;markE6:string;indexE6:string;localBidE6:string;localAskE6:string;basisTwapE6:string;closeTime:string;oracleUpdatedAt:string};
export type PortfolioProjection={address:string;owner:string;slot:number;capital:string;pnl:string;portfolioId:string;positionEpoch:string;sequence:string;health:HealthProjection;positions:readonly PositionProjection[]};
export type HealthProjection={valid:boolean;equity:string;initialRequirement:string;maintenanceRequirement:string;liquidationDeficit:string;worstCaseLoss:string};
export type PositionProjection={slot:number;assetIndex:number;marketId:string;side:"long"|"short";sizeQ:string;entryNotional:string;stale:boolean};
export type EventProjection={signature:string;instructionIndex:number;slot:number;kind:"trade"|"funding"|"deposit"|"withdrawal"|"crank"|"liquidation"|"resolution";marketId?:string;portfolio?:string;blockTime?:number;data:Record<string,string>};
export type ServiceHealth={oracleLastSlot:number;keeperLastSlot:number;indexedSlot:number};
export type PricePoint={slot:number;observedAt:string;markE6:string;indexE6:string;localMidE6:string;basisTwapE6:string};

export class ProjectionStore{
 readonly markets=new Map<string,MarketProjection>(); readonly portfolios=new Map<string,PortfolioProjection>(); readonly events=new Map<string,EventProjection>();readonly prices=new Map<string,PricePoint[]>();
 health:ServiceHealth={oracleLastSlot:0,keeperLastSlot:0,indexedSlot:0};
 upsertMarket(input:MarketProjection){const x={...input,localBidE6:input.localBidE6??input.markE6,localAskE6:input.localAskE6??input.markE6,basisTwapE6:input.basisTwapE6??"0"};const old=this.markets.get(x.address);if(!old||x.slot>=old.slot){this.markets.set(x.address,x);const series=this.prices.get(x.address)??[];const last=series.at(-1),localMid=((BigInt(x.localBidE6)+BigInt(x.localAskE6))/2n).toString();if(!last||last.markE6!==x.markE6||last.indexE6!==x.indexE6||last.observedAt!==x.oracleUpdatedAt){series.push({slot:x.slot,observedAt:x.oracleUpdatedAt,markE6:x.markE6,indexE6:x.indexE6,localMidE6:localMid,basisTwapE6:x.basisTwapE6});this.prices.set(x.address,series.slice(-500))}}this.health.indexedSlot=Math.max(this.health.indexedSlot,x.slot)}
 upsertPortfolio(x:PortfolioProjection){const old=this.portfolios.get(x.address);if(!old||x.slot>=old.slot)this.portfolios.set(x.address,x);this.health.indexedSlot=Math.max(this.health.indexedSlot,x.slot)}
 insertEvent(x:EventProjection){const key=`${x.signature}:${x.instructionIndex}`;const old=this.events.get(key);if(!old||x.slot>=old.slot)this.events.set(key,x);this.health.indexedSlot=Math.max(this.health.indexedSlot,x.slot)}
 reset(){this.markets.clear();this.portfolios.clear();this.events.clear();this.prices.clear();this.health={oracleLastSlot:0,keeperLastSlot:0,indexedSlot:0}}
 snapshot(){return{version:2,markets:[...this.markets.values()],portfolios:[...this.portfolios.values()],events:[...this.events.values()],prices:[...this.prices],health:this.health}}
 restore(x:any){if(x?.version!==1&&x?.version!==2)throw new Error("unsupported index snapshot");this.reset();for(const m of x.markets??[])this.upsertMarket(m);for(const p of x.portfolios??[])this.upsertPortfolio(p);for(const e of x.events??[])this.insertEvent(e);for(const [address,points] of x.prices??[])this.prices.set(address,points);this.health={...this.health,...x.health}}
}
