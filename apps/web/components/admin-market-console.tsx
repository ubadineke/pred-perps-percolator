"use client";

import { useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { ComputeBudgetProgram, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { AlertTriangle, Check, ExternalLink, LockKeyhole, Radio, ShieldCheck } from "lucide-react";
import { getPantaMarket, type ApiPantaMarket } from "@/lib/api";
import { usePrivyWalletState } from "./wallet-providers";

type AdminConfig={adminAddress:string;marketAccount:string;oracleProgramId:string;percolatorProgramId:string;nextAssetIndex:number;nextMarketId:string;cluster:string};
const encoder=new TextEncoder();
const short=(value:string)=>value?`${value.slice(0,4)}…${value.slice(-4)}`:"Not configured";
const probability=(value?:number)=>value===undefined?"—":`${(value/10_000).toFixed(2)}%`;
const sha256=async(value:string)=>new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(value)));
const i64=(view:DataView,offset:number,value:bigint)=>view.setBigInt64(offset,value,true);
const u64=(view:DataView,offset:number,value:bigint)=>view.setBigUint64(offset,value,true);

async function activationData(market:ApiPantaMarket,assetIndex:number,marketId:bigint,mark:number,slot:bigint,minutes:{restricted:number;reduceOnly:number;hardFlat:number}){
  const close=BigInt(Math.floor(market.closeTime/1_000));
  const data=new Uint8Array(219),view=new DataView(data.buffer);data[0]=5;let offset=1;
  for(const value of[market.providerMarketId,`${market.providerMarketId}:YES`,`${market.providerMarketId}:NO`,market.title,market.rules]){data.set(await sha256(value),offset);offset+=32}
  i64(view,offset,close);offset+=8;view.setUint16(offset,assetIndex,true);offset+=2;u64(view,offset,marketId);offset+=8;u64(view,offset,BigInt(mark));offset+=8;u64(view,offset,slot);offset+=8;
  i64(view,offset,close-BigInt(minutes.restricted*60));offset+=8;i64(view,offset,close-BigInt(minutes.reduceOnly*60));offset+=8;i64(view,offset,close-BigInt(minutes.hardFlat*60));
  return data;
}

export function AdminMarketConsole({markets,config}:{markets:ApiPantaMarket[];config:AdminConfig}){
  const {connection}=useConnection();const wallet=useWallet();const privy=usePrivyWalletState();
  const [selectedId,setSelectedId]=useState(markets[0]?.providerMarketId??"");
  const [detail,setDetail]=useState<ApiPantaMarket|undefined>(markets[0]);
  const [loading,setLoading]=useState(false);const [error,setError]=useState("");const [signature,setSignature]=useState("");
  const [mark,setMark]=useState(markets[0]?.indexPriceE6??500_000);const [restricted,setRestricted]=useState(30);const [reduceOnly,setReduceOnly]=useState(10);const [hardFlat,setHardFlat]=useState(1);const [liquidityConfirmed,setLiquidityConfirmed]=useState(false);
  const externalAddress=wallet.publicKey?.toBase58()??"";const activeAddress=externalAddress||privy.address||"";
  const authorityMatch=Boolean(externalAddress&&config.adminAddress&&externalAddress===config.adminAddress);
  const eligible=Boolean(detail&&detail.status==="open"&&detail.closeTime>Date.now()+15*60_000&&detail.indexPriceE6!==undefined&&detail.rules.trim());
  const clockValid=restricted>reduceOnly&&reduceOnly>hardFlat&&hardFlat>0;
  const configured=Boolean(config.adminAddress&&config.marketAccount&&config.oracleProgramId&&config.percolatorProgramId);
  const canActivate=eligible&&clockValid&&configured&&authorityMatch&&liquidityConfirmed&&!loading;
  const checks=useMemo(()=>[
    [detail?.status==="open","Provider market is open"],[Boolean(detail&&detail.closeTime>Date.now()+15*60_000),"More than 15 minutes to close"],[Boolean(detail?.indexPriceE6&&detail.indexPriceE6<1_000_000),"Valid probability index"],[Boolean(detail?.rules.trim()),"Resolution rules frozen"],[clockValid,"Lock-clock ordering is valid"],[liquidityConfirmed,"Local matcher liquidity confirmed"],
  ] as const,[detail,clockValid,liquidityConfirmed]);

  useEffect(()=>{if(!selectedId)return;let active=true;setLoading(true);setError("");setSignature("");getPantaMarket(selectedId).then(value=>{if(!active)return;setDetail(value);setMark(value.indexPriceE6??500_000)}).catch(cause=>active&&setError(cause instanceof Error?cause.message:"Could not load provider market.")).finally(()=>active&&setLoading(false));return()=>{active=false}},[selectedId]);

  async function activate(){
    if(!detail||!wallet.publicKey||!wallet.sendTransaction||!canActivate)return;
    setLoading(true);setError("");setSignature("");
    try{
      const oracle=new PublicKey(config.oracleProgramId),percolator=new PublicKey(config.percolatorProgramId),marketAccount=new PublicKey(config.marketAccount);
      const [oracleConfig]=PublicKey.findProgramAddressSync([encoder.encode("config"),marketAccount.toBytes()],oracle);
      const marketHash=await sha256(detail.providerMarketId);
      const [record]=PublicKey.findProgramAddressSync([encoder.encode("imported"),oracleConfig.toBytes(),marketHash],oracle);
      const slot=BigInt(await connection.getSlot("confirmed"));
      const data=await activationData(detail,config.nextAssetIndex,BigInt(config.nextMarketId),mark,slot,{restricted,reduceOnly,hardFlat});
      const instruction=new TransactionInstruction({programId:oracle,keys:[{pubkey:wallet.publicKey,isSigner:true,isWritable:true},{pubkey:wallet.publicKey,isSigner:true,isWritable:false},{pubkey:oracleConfig,isSigner:false,isWritable:false},{pubkey:record,isSigner:false,isWritable:true},{pubkey:marketAccount,isSigner:false,isWritable:true},{pubkey:percolator,isSigner:false,isWritable:false},{pubkey:SystemProgram.programId,isSigner:false,isWritable:false}],data:Buffer.from(data)});
      const transaction=new Transaction().add(ComputeBudgetProgram.requestHeapFrame({bytes:128*1024}),ComputeBudgetProgram.setComputeUnitLimit({units:1_400_000}),instruction);
      const sent=await wallet.sendTransaction(transaction,connection,{skipPreflight:false});await connection.confirmTransaction(sent,"confirmed");setSignature(sent);
    }catch(cause){const message=cause instanceof Error?cause.message:"Activation failed.";if(!/reject|cancel/i.test(message))setError(message)}finally{setLoading(false)}
  }

  return <div className="admin-console">
    <aside className="admin-queue" aria-label="Provider market queue">
      <div className="admin-panel-heading"><span>PROVIDER QUEUE</span><b>{markets.length} records</b></div>
      {markets.length?markets.map(market=><button key={market.providerMarketId} type="button" className={selectedId===market.providerMarketId?"selected":""} onClick={()=>setSelectedId(market.providerMarketId)}>
        <span><i className={market.status}/>{market.category??"EVENT"}<em>{market.status}</em></span><strong>{market.title}</strong><small>{probability(market.indexPriceE6)} YES · Panta</small>
      </button>):<div className="admin-empty"><b>No provider markets</b><span>Refresh the indexer after configuring a provider key.</span></div>}
    </aside>
    <section className="admission-workspace">
      <header><div><span className="admin-section-label"><Radio size={13}/> ADMISSION REVIEW</span><h2>{detail?.title??"Select a provider market"}</h2><p>Review immutable identity, lifecycle, and operational readiness before signing activation.</p></div>{detail?.sourceUrl?<a href={detail.sourceUrl} target="_blank" rel="noreferrer">Panta source <ExternalLink size={14}/></a>:null}</header>
      {loading&&!detail?<div className="admin-skeleton" aria-label="Loading market"><i/><i/><i/></div>:null}
      {detail?<>
        <div className="admission-summary"><div><span>INDEX</span><b>{probability(detail.indexPriceE6)}</b></div><div><span>STATE</span><b>{detail.status.toUpperCase()}</b></div><div><span>NETWORK</span><b>MAINNET SOURCE</b></div><div><span>NEXT ASSET</span><b>#{config.nextAssetIndex} / ID {config.nextMarketId}</b></div></div>
        <div className="admin-form-grid">
          <fieldset><legend>Activation parameters</legend><label>Initial mark <span>1–999,999 E6</span><input type="number" min="1" max="999999" value={mark} onChange={e=>setMark(Number(e.target.value))}/></label><div className="clock-inputs"><label>Restricted <span>minutes before close</span><input type="number" min="3" value={restricted} onChange={e=>setRestricted(Number(e.target.value))}/></label><label>Reduce-only <span>minutes before close</span><input type="number" min="2" value={reduceOnly} onChange={e=>setReduceOnly(Number(e.target.value))}/></label><label>Hard-flat <span>minutes before close</span><input type="number" min="1" value={hardFlat} onChange={e=>setHardFlat(Number(e.target.value))}/></label></div></fieldset>
          <div className="admission-checks"><span className="admin-section-label">PRE-FLIGHT</span>{checks.map(([pass,label])=><div className={pass?"pass":"fail"} key={label}>{pass?<Check size={14}/>:<AlertTriangle size={14}/>}<span>{label}</span></div>)}</div>
        </div>
        <div className="rules-freeze"><span>RESOLUTION RULES</span><p>{detail.rules||"No detailed resolution rules were returned by the provider."}</p></div>
        <label className="liquidity-attestation"><input type="checkbox" checked={liquidityConfirmed} onChange={e=>setLiquidityConfirmed(e.target.checked)}/><span><b>Local liquidity is configured</b><small>I verified the Moxie matcher can quote this market. Panta’s index is not executable depth.</small></span></label>
        <footer className="admin-submit"><div><span className="authority-line"><LockKeyhole size={13}/> REQUIRED AUTHORITY</span><code title={config.adminAddress}>{short(config.adminAddress)}</code><em className={authorityMatch?"match":""}>{!activeAddress?"Connect the authority wallet":authorityMatch?"Authority verified":`Connected: ${short(activeAddress)}`}</em></div><button type="button" disabled={!canActivate} onClick={activate}>{loading?"Preparing transaction…":"Review & sign activation"}<ShieldCheck size={16}/></button></footer>
        {error?<div className="admin-notice error" role="alert"><AlertTriangle size={15}/><span><b>Activation not submitted</b>{error}</span></div>:null}
        {signature?<div className="admin-notice success" role="status"><Check size={15}/><span><b>Market activated</b><a href={`https://explorer.solana.com/tx/${signature}?cluster=${config.cluster}`} target="_blank" rel="noreferrer">View transaction <ExternalLink size={13}/></a></span></div>:null}
      </>:null}
    </section>
  </div>;
}
