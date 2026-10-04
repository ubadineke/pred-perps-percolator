import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { ComputeBudgetProgram, Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { PantaPredictionSource } from "../../../packages/provider-adapter/src/panta.ts";
import { encodePricingObservation } from "../../../packages/sdk/src/imported-market.ts";

type IndexedMarket={address:string;provider?:string;providerMarketId:string;rules:string;assetIndex:number;marketId:string;status:number};
const required=(name:string)=>{const value=process.env[name]?.trim();if(!value)throw new Error(`${name} is required`);return value};
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
type BasisSample={at:number;basis:bigint};const basisHistory=new Map<string,BasisSample[]>(),TWAP_WINDOW_MS=30*60*1_000;
const u32=(v:DataView,o:number)=>BigInt(v.getUint32(o,true));
const u128=(v:DataView,o:number)=>v.getBigUint64(o,true)|(v.getBigUint64(o+8,true)<<64n);
const i128=(v:DataView,o:number)=>{const x=u128(v,o);return x&(1n<<127n)?x-(1n<<128n):x};
function quote(data:Uint8Array,oracle:bigint,requested:bigint){const v=new DataView(data.buffer,data.byteOffset,data.byteLength),s=64,base=u32(v,s+48),max=u32(v,s+52),size=u32(v,s+56),skew=u32(v,s+60),charges=u32(v,s+64)+u32(v,s+68)+u32(v,s+144)+u32(v,s+148),epsilon=u32(v,s+152),capacity=u128(v,s+112),inventory=i128(v,s+128),abs=requested<0n?-requested:requested,inventoryAdjustment=(((-inventory*2n)+requested)*skew)/(capacity*2n),sizeAdjustment=(abs*size+capacity-1n)/capacity,raw=inventoryAdjustment+(base+charges+sizeAdjustment)*(requested>0n?1n:-1n),bounded=raw < -max ? -max : raw > max ? max : raw,p=oracle+bounded;return p<epsilon?epsilon:p>1_000_000n-epsilon?1_000_000n-epsilon:p}
function rollingBasis(key:string,basis:bigint,now:number){const start=now-TWAP_WINDOW_MS,history=[...(basisHistory.get(key)??[]).filter(x=>x.at>=start),{at:now,basis}];basisHistory.set(key,history);if(history.length===1)return basis;let weighted=0n,total=0n,active=history[0],cursor=start;for(const sample of history){const at=Math.max(start,Math.min(now,sample.at));if(at>cursor){const dt=BigInt(at-cursor);weighted+=active.basis*dt;total+=dt;cursor=at}active=sample}if(cursor<now){const dt=BigInt(now-cursor);weighted+=active.basis*dt;total+=dt}return total?weighted/total:basis}
function lastExecution(data:Uint8Array,assetIndex:number,fallback:bigint){const v=new DataView(data.buffer,data.byteOffset,data.byteLength);if(data.length<64||v.getUint32(0,true)!==3||(v.getUint32(4,true)&4)!==0||v.getBigUint64(56,true)!==BigInt(assetIndex))return fallback;const price=v.getBigUint64(8,true);return price>0n&&price<1_000_000n?price:fallback}

const rpc=process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim()||process.env.SOLANA_RPC_URL?.trim()||process.env.DEVNET_RPC_URL?.trim();if(!rpc)throw new Error("SOLANA_RPC_URL is required");
const oracleProgram=new PublicKey(required("MOXIE_ORACLE_PROGRAM_ID")),percolator=new PublicKey(required("PERCOLATOR_PROGRAM_ID")),marketGroup=new PublicKey(required("MOXIE_MARKET_ACCOUNT")),matcherContext=new PublicKey(required("MOXIE_MATCHER_CONTEXT")),api=(process.env.MOXIE_API_URL??"http://127.0.0.1:8787").replace(/\/$/,""),interval=Math.max(5_000,Number(process.env.ORACLE_REPORT_INTERVAL_MS??10_000));
const connection=new Connection(rpc,"confirmed"),source=new PantaPredictionSource(),secret=JSON.parse(await readFile(process.env.SOLANA_KEYPAIR_PATH??`${homedir()}/.config/solana/id.json`,"utf8")) as number[],reporter=Keypair.fromSecretKey(Uint8Array.from(secret));
const [config]=PublicKey.findProgramAddressSync([Buffer.from("config"),marketGroup.toBytes()],oracleProgram);

async function cycle(){
  const response=await fetch(`${api}/v1/markets`);if(!response.ok)throw new Error(`indexer returned ${response.status}`);const markets=await response.json() as IndexedMarket[],matcher=await connection.getAccountInfo(matcherContext,"confirmed");if(!matcher)throw new Error("matcher context not found");
  for(const indexed of markets.filter(x=>x.provider==="panta"&&x.status>0&&x.status<4)){
    try{const external=await source.getMarket(indexed.providerMarketId);if(external.indexPriceE6===undefined)throw new Error("Panta detail has no complementary YES/NO index");const recordKey=new PublicKey(indexed.address),record=await connection.getAccountInfo(recordKey,"confirmed");if(!record)throw new Error("market record not found");const index=BigInt(external.indexPriceE6),sequence=new DataView(record.data.buffer,record.data.byteOffset,record.data.byteLength).getBigUint64(272,true)+1n,impact=1_000_000n,localBid=quote(matcher.data,index,-impact),localAsk=quote(matcher.data,index,impact),localMid=(localBid+localAsk)/2n,now=Date.now(),basisTwap=rollingBasis(indexed.address,localMid-index,now),localLast=lastExecution(matcher.data,indexed.assetIndex,localMid);
      const data=encodePricingObservation({externalMarketId:indexed.providerMarketId,rules:indexed.rules,assetIndex:indexed.assetIndex,marketId:BigInt(indexed.marketId)},{indexE6:index,externalImpactBidE6:index,externalImpactAskE6:index,localImpactBidE6:localBid,localImpactAskE6:localAsk,localLastE6:localLast,basisTwapE6:basisTwap,sourceTimestamp:BigInt(Math.floor(now/1000)),sequence,oracleHealth:1});
      const ix=new TransactionInstruction({programId:oracleProgram,keys:[{pubkey:reporter.publicKey,isSigner:true,isWritable:false},{pubkey:config,isSigner:false,isWritable:false},{pubkey:recordKey,isSigner:false,isWritable:true},{pubkey:marketGroup,isSigner:false,isWritable:true},{pubkey:percolator,isSigner:false,isWritable:false}],data:Buffer.from(data)}),tx=new Transaction().add(ComputeBudgetProgram.requestHeapFrame({bytes:128*1024}),ComputeBudgetProgram.setComputeUnitLimit({units:1_400_000}),ix),signature=await connection.sendTransaction(tx,[reporter],{skipPreflight:false});await connection.confirmTransaction(signature,"confirmed");console.log(`[oracle] ${indexed.providerMarketId} index=${index} last=${localLast} mid=${localMid} basis_twap=${basisTwap} sequence=${sequence} tx=${signature}`)
    }catch(error){console.error(`[oracle] ${indexed.providerMarketId}:`,error instanceof Error?error.message:error)}
  }
}
console.log(`[oracle] reporter=${reporter.publicKey.toBase58()} interval=${interval}ms`);
for(;;){try{await cycle()}catch(error){console.error("[oracle] cycle:",error instanceof Error?error.message:error)}await sleep(interval)}
