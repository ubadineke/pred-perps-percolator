import type{ChainAccount,ChainSource}from"./indexer.ts";import type{EventProjection}from"./store.ts";

type RpcResult<T>={result:T;error?:{message:string}};
const alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58(value:string){let n=0n;for(const c of value){const digit=alphabet.indexOf(c);if(digit<0)throw new Error("invalid base58");n=n*58n+BigInt(digit)}const tail:number[]=[];while(n){tail.push(Number(n&255n));n>>=8n}tail.reverse();let zeroes=0;while(value[zeroes]==="1")zeroes++;return Uint8Array.from([...Array(zeroes).fill(0),...tail])}
const u64=(b:Uint8Array,o:number)=>new DataView(b.buffer,b.byteOffset,b.byteLength).getBigUint64(o,true).toString();
const i128=(b:Uint8Array,o:number)=>{const v=new DataView(b.buffer,b.byteOffset,b.byteLength),x=v.getBigUint64(o,true)|(v.getBigUint64(o+8,true)<<64n);return(x&(1n<<127n)?x-(1n<<128n):x).toString()};

export class SolanaRpcSource implements ChainSource{
 private id=0;
 readonly rpcUrl:string;readonly oracleProgramId:string;readonly percolatorProgramId:string;
 // Optional market-group scope: imported-market records store their Percolator market group at byte 192.
 readonly marketGroup:string|undefined;
 readonly extraEventAddresses:readonly string[];
 constructor(rpcUrl:string,oracleProgramId:string,percolatorProgramId:string,marketGroup?:string,extraEventAddresses:readonly(string|undefined)[]=[]){this.rpcUrl=rpcUrl;this.oracleProgramId=oracleProgramId;this.percolatorProgramId=percolatorProgramId;this.marketGroup=marketGroup||undefined;this.extraEventAddresses=extraEventAddresses.filter((x):x is string=>Boolean(x))}
 private async rpc<T>(method:string,params:unknown[]):Promise<T>{const response=await fetch(this.rpcUrl,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:++this.id,method,params})});if(!response.ok)throw new Error(`rpc ${method}: ${response.status}`);const body=await response.json() as RpcResult<T>;if(body.error)throw new Error(`rpc ${method}: ${body.error.message}`);return body.result}
 async getSlot(){return this.rpc<number>("getSlot",[{commitment:"confirmed"}])}
 private async accounts(programId:string,size:number,extraFilters:readonly object[]=[]):Promise<readonly ChainAccount[]>{const result=await this.rpc<any>("getProgramAccounts",[programId,{commitment:"confirmed",encoding:"base64",withContext:true,filters:[{dataSize:size},...extraFilters]}]);const slot=result.context?.slot??await this.getSlot();return result.value.map((x:any)=>({address:x.pubkey,owner:x.account.owner,slot,data:Uint8Array.from(Buffer.from(x.account.data[0],"base64"))}))}
 getImportedMarketAccounts(){return this.accounts(this.oracleProgramId,384,this.marketGroup?[{memcmp:{offset:192,bytes:this.marketGroup}}]:[])}
 // Portfolio accounts store their market group at byte 16 (provenance header).
 getPortfolioAccounts(){return this.accounts(this.percolatorProgramId,9563,this.marketGroup?[{memcmp:{offset:16,bytes:this.marketGroup}}]:[])}
	 // Signatures already turned into events; repeated syncs skip their getTransaction round trip.
	 private readonly processedSignatures=new Set<string>();
	 async getEvents(fromSlot:number,toSlot=Number.MAX_SAFE_INTEGER):Promise<readonly EventProjection[]>{
	  const out:EventProjection[]=[];const processedThisSync:string[]=[];
	  const programs=new Set([this.oracleProgramId,this.percolatorProgramId]);
	  // Trades always touch the matcher context and keeper cranks never do, so scan it first and over its
	  // full history: program-wide windows are dominated by crank traffic and would miss older fills.
	  const scans:[address:string,floor:number][]=[...this.extraEventAddresses.map(a=>[a,0] as [string,number]),[this.oracleProgramId,fromSlot],[this.percolatorProgramId,fromSlot]];
	  for(const [address,floor] of scans){let before:string|undefined;for(let page=0;page<10;page++){const options:any={limit:1000,commitment:"confirmed"};if(before)options.before=before;const sigs=await this.rpc<any[]>("getSignaturesForAddress",[address,options]);if(!sigs.length)break;for(const s of sigs){if(s.err||s.slot<floor||s.slot>toSlot||this.processedSignatures.has(s.signature))continue;const tx=await this.rpc<any>("getTransaction",[s.signature,{commitment:"confirmed",encoding:"json",maxSupportedTransactionVersion:0}]);if(!tx)continue;const keys=tx.transaction.message.accountKeys.map((x:any)=>typeof x==="string"?x:x.pubkey);const logs=(tx.meta?.logMessages??[]).join(" ").toLowerCase();tx.transaction.message.instructions.forEach((ix:any,instructionIndex:number)=>{const program=keys[ix.programIdIndex];if(!programs.has(program)||!ix.data)return;const data=base58(ix.data);const event=this.parseInstruction(s.signature,s.slot,instructionIndex,program,data,(ix.accounts??[]).map((i:number)=>keys[i]),logs);if(event)out.push({...event,blockTime:s.blockTime??tx?.blockTime??undefined})});processedThisSync.push(s.signature)}if(sigs.at(-1).slot<floor)break;before=sigs.at(-1).signature}}
 // Only a completed sync marks its signatures; a failed sync is retried in full.
 for(const signature of processedThisSync)this.processedSignatures.add(signature);
 return out}
	 private parseInstruction(signature:string,slot:number,instructionIndex:number,program:string,data:Uint8Array,accounts:string[],logs:string):EventProjection|undefined{if(this.marketGroup&&!accounts.includes(this.marketGroup))return undefined;// other market groups share market ids; keep only the configured group
const tag=data[0];let kind:EventProjection["kind"]|undefined;if(program===this.oracleProgramId&&tag===8)kind="resolution";else if(program===this.percolatorProgramId&&tag===3)kind="deposit";else if(program===this.percolatorProgramId&&tag===4)kind="withdrawal";else if(program===this.percolatorProgramId&&tag===5)kind=logs.includes("liquidat")?"liquidation":"crank";else if(program===this.percolatorProgramId&&(tag===6||tag===10||tag===66||tag===67||tag===69))kind="trade";else if(program===this.percolatorProgramId&&(tag===63||tag===70))kind="funding";else if(program===this.percolatorProgramId&&(tag===19||tag===30))kind="resolution";if(!kind)return;let marketId:string|undefined;const detail:Record<string,string>={tag:String(tag),program};if(tag===6&&data.length>=43)marketId=u64(data,35);if(tag===10&&data.length>=85){marketId=u64(data,43);detail.assetIndex=String(new DataView(data.buffer,data.byteOffset,data.byteLength).getUint16(41,true));detail.sizeQ=i128(data,51);detail.feeBps=u64(data,67);detail.limitPriceE6=u64(data,75);const fill=logs.match(/moxie_fill asset=(\d+) price_e6=(\d+) size_q=(-?\d+)/);if(fill&&fill[1]===detail.assetIndex){detail.executionPriceE6=fill[2];detail.executedSizeQ=fill[3]}}if((tag===63||tag===70)&&data.length>=11)marketId=u64(data,3);return{signature,instructionIndex,slot,kind,marketId,portfolio:accounts[2]??accounts[1],data:detail}}
}
