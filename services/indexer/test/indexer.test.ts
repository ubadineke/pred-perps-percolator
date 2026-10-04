import assert from"node:assert/strict";import test from"node:test";import{ProjectionStore}from"../src/store.ts";
import{MoxieIndexer}from"../src/indexer.ts";
import{SolanaRpcSource}from"../src/rpc-source.ts";
test("writes are slot-idempotent and events deduplicate",()=>{const s=new ProjectionStore();const m={address:"m",provider:"panta",providerMarketId:"p",title:"t",rules:"r",slot:2,assetIndex:1,marketId:"2",status:1,markE6:"5",indexE6:"5",localBidE6:"4",localAskE6:"6",basisTwapE6:"0",closeTime:"9",oracleUpdatedAt:"1"};s.upsertMarket(m);s.upsertMarket({...m,slot:1,markE6:"4"});assert.equal(s.markets.get("m")?.markE6,"5");const e={signature:"s",instructionIndex:0,slot:2,kind:"trade" as const,data:{}};s.insertEvent(e);s.insertEvent(e);assert.equal(s.events.size,1)});
test("first sync backfills events before advancing the checkpoint",async()=>{let requested=-1;const source={getSlot:async()=>10,getImportedMarketAccounts:async()=>[],getPortfolioAccounts:async()=>[],getEvents:async(from:number)=>{requested=from;return[{signature:"x",instructionIndex:0,slot:9,kind:"crank" as const,data:{}}]}};const x=new MoxieIndexer(source);await x.sync();assert.equal(requested,0);assert.equal(x.store.events.size,1);assert.equal(x.store.health.keeperLastSlot,9)});
test("decodes the 85-byte TradeCpi ABI and authenticated matcher fill log",async()=>{
 const oldFetch=globalThis.fetch;let signaturePage=0;
 globalThis.fetch=(async(_input,init)=>{const request=JSON.parse(String(init?.body));let result:unknown;
  if(request.method==="getSignaturesForAddress")result=request.params[0]==="owner"&&signaturePage++===0?[{signature:"sig",slot:2,err:null}]:[];
  else if(request.method==="getTransaction")result={transaction:{message:{accountKeys:["owner","context","market","trader","lp","matcher","delegate"],instructions:[{programIdIndex:5,accounts:[],data:""},{programIdIndex:0,accounts:[0,2,3],data:"49kvAxBu8hLgm3g7JLUc5DdjQz5j8mx5s6XNoWNu2TJaTWPRkgT5SYJNELDSDWnUiwjWcRuZvZVpF3GxrierNzPsm9NZpZVcJoomEQiLy9ZA6YRVxAYX"}]}},meta:{logMessages:["Program log: moxie_fill asset=4 price_e6=507500 size_q=1000000"]}};
  else throw new Error(`unexpected ${request.method}`);
  return new Response(JSON.stringify({jsonrpc:"2.0",id:1,result}),{status:200,headers:{"content-type":"application/json"}})
 }) as typeof fetch;
 try{const source=new SolanaRpcSource("http://rpc","oracle","owner"),events=await source.getEvents(1,3),trade=events.find(x=>x.kind==="trade");assert.equal(trade?.marketId,"5");assert.equal(trade?.data.assetIndex,"4");assert.equal(trade?.data.executionPriceE6,"507500");assert.equal(trade?.data.executedSizeQ,"1000000")}
 finally{globalThis.fetch=oldFetch}
});
