import {createServer,type Server} from "node:http";import type{ProjectionStore}from"./store.ts";
const json=(res:any,status:number,body:unknown)=>{res.writeHead(status,{"content-type":"application/json","cache-control":"no-store"});res.end(JSON.stringify(body,(_,v)=>typeof v==="bigint"?v.toString():v))};
export function createIndexerApi(store:ProjectionStore):Server{return createServer((req,res)=>{const url=new URL(req.url??"/","http://localhost");const parts=url.pathname.split("/").filter(Boolean);
 if(url.pathname==="/health")return json(res,200,store.health);
 if(url.pathname==="/v1/markets")return json(res,200,[...store.markets.values()]);
 if(parts[0]==="v1"&&parts[1]==="markets"&&parts[2]){const x=store.markets.get(parts[2]);if(!x)return json(res,404,{error:"not-found"});if(parts[3]==="trades")return json(res,200,[...store.events.values()].filter(e=>e.kind==="trade"&&e.marketId===x.marketId));if(parts[3]==="funding")return json(res,200,[...store.events.values()].filter(e=>e.kind==="funding"&&e.marketId===x.marketId));return json(res,200,x)}
 if(parts[0]==="v1"&&parts[1]==="portfolios"&&parts[2]){const x=store.portfolios.get(parts[2]);if(!x)return json(res,404,{error:"not-found"});if(parts[3]==="positions")return json(res,200,x.positions);if(parts[3]==="transactions")return json(res,200,[...store.events.values()].filter(e=>e.portfolio===x.address));return json(res,200,x)}
 if(url.pathname==="/v1/status/oracle")return json(res,200,{lastSlot:store.health.oracleLastSlot,indexedSlot:store.health.indexedSlot});
 if(url.pathname==="/v1/status/keeper")return json(res,200,{lastSlot:store.health.keeperLastSlot,indexedSlot:store.health.indexedSlot});
 if(url.pathname==="/v1/events")return json(res,200,[...store.events.values()].sort((a,b)=>b.slot-a.slot));
 return json(res,404,{error:"not-found"});})}
