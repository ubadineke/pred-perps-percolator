export type MarketProjection={address:string;providerMarketId:string;title:string;rules:string;slot:number;assetIndex:number;marketId:string;status:number;markE6:string;indexE6:string;closeTime:string;oracleUpdatedAt:string};
export type PortfolioProjection={address:string;owner:string;slot:number;capital:string;pnl:string;health:HealthProjection;positions:readonly PositionProjection[]};
export type HealthProjection={valid:boolean;equity:string;initialRequirement:string;maintenanceRequirement:string;liquidationDeficit:string;worstCaseLoss:string};
export type PositionProjection={slot:number;assetIndex:number;marketId:string;side:"long"|"short";sizeQ:string;entryNotional:string;stale:boolean};
export type EventProjection={signature:string;instructionIndex:number;slot:number;kind:"trade"|"funding"|"deposit"|"withdrawal"|"crank"|"liquidation"|"resolution";marketId?:string;portfolio?:string;data:Record<string,string>};
export type ServiceHealth={oracleLastSlot:number;keeperLastSlot:number;indexedSlot:number};

export class ProjectionStore{
 readonly markets=new Map<string,MarketProjection>(); readonly portfolios=new Map<string,PortfolioProjection>(); readonly events=new Map<string,EventProjection>();
 health:ServiceHealth={oracleLastSlot:0,keeperLastSlot:0,indexedSlot:0};
 upsertMarket(x:MarketProjection){const old=this.markets.get(x.address);if(!old||x.slot>=old.slot)this.markets.set(x.address,x);this.health.indexedSlot=Math.max(this.health.indexedSlot,x.slot)}
 upsertPortfolio(x:PortfolioProjection){const old=this.portfolios.get(x.address);if(!old||x.slot>=old.slot)this.portfolios.set(x.address,x);this.health.indexedSlot=Math.max(this.health.indexedSlot,x.slot)}
 insertEvent(x:EventProjection){const key=`${x.signature}:${x.instructionIndex}`;const old=this.events.get(key);if(!old||x.slot>=old.slot)this.events.set(key,x);this.health.indexedSlot=Math.max(this.health.indexedSlot,x.slot)}
 reset(){this.markets.clear();this.portfolios.clear();this.events.clear();this.health={oracleLastSlot:0,keeperLastSlot:0,indexedSlot:0}}
 snapshot(){return{version:1,markets:[...this.markets.values()],portfolios:[...this.portfolios.values()],events:[...this.events.values()],health:this.health}}
 restore(x:any){if(x?.version!==1)throw new Error("unsupported index snapshot");this.reset();for(const m of x.markets??[])this.upsertMarket(m);for(const p of x.portfolios??[])this.upsertPortfolio(p);for(const e of x.events??[])this.insertEvent(e);this.health={...this.health,...x.health}}
}
