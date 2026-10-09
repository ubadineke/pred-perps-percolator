"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { ComputeBudgetProgram, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { AlertTriangle, Check, ExternalLink, LockKeyhole, Radio, ShieldCheck } from "lucide-react";
import { getPantaMarket, type ApiPantaMarket } from "@/lib/api";
import { usePrivyWalletState } from "./wallet-providers";
import { Alert, Badge, EmptyState, Panel, PanelHeader, Skeleton, Stat } from "./ui/primitives";
import { Button, buttonClasses } from "./ui/button";
import { cn } from "@/lib/utils";

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

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <Panel aria-label="Provider market queue" className="lg:max-h-[calc(100dvh-14rem)] lg:overflow-y-auto">
        <PanelHeader title="Provider queue" description={`${markets.length} markets from Panta`} />
        {markets.length ? (
          <ul className="divide-y divide-border">
            {markets.map((market) => {
              const selected = selectedId === market.providerMarketId;
              return (
                <li key={market.providerMarketId}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(market.providerMarketId)}
                    aria-pressed={selected}
                    className={cn("w-full border-l-2 px-5 py-3.5 text-left transition-colors", selected ? "border-signal bg-surface-2" : "border-transparent hover:bg-surface-2")}
                  >
                    <span className="flex items-center justify-between gap-2 text-xs text-subtle">
                      <span>{market.category ?? "Event"}</span>
                      <Badge tone={market.status === "open" ? "long" : "neutral"}>{market.status}</Badge>
                    </span>
                    <span className="mt-1.5 line-clamp-2 block text-sm font-medium leading-snug text-foreground">{market.title}</span>
                    <span className="mt-1 block font-mono text-xs text-muted">{probability(market.indexPriceE6)} yes</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title="No provider markets" description="Refresh the indexer after configuring a provider key." />
        )}
      </Panel>

      <Panel className="min-w-0">
        <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-signal"><Radio className="size-3.5" aria-hidden="true" /> Admission review</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">{detail?.title ?? "Select a provider market"}</h2>
            <p className="mt-1 text-sm text-muted">Check identity, lifecycle and liquidity before signing the activation.</p>
          </div>
          {detail?.sourceUrl ? (
            <a href={detail.sourceUrl} target="_blank" rel="noreferrer" className={buttonClasses({ variant: "outline", size: "sm" })}>
              View on Panta <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          ) : null}
        </div>

        {loading && !detail ? (
          <div className="space-y-3 p-5" aria-busy="true">
            <Skeleton className="h-20" />
            <Skeleton className="h-40" />
          </div>
        ) : null}

        {detail ? (
          <div className="space-y-6 p-5">
            <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border p-4 sm:grid-cols-4">
              <Stat size="sm" label="Source index" value={probability(detail.indexPriceE6)} />
              <Stat size="sm" label="Provider state" value={detail.status} />
              <Stat size="sm" label="Source network" value="Mainnet" />
              <Stat size="sm" label="Next asset" value={`#${config.nextAssetIndex} · ID ${config.nextMarketId}`} />
            </dl>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
              <fieldset className="space-y-4">
                <legend className="text-sm font-semibold">Activation parameters</legend>
                <NumberInput label="Initial mark" hint="1–999,999 (E6)" value={mark} min={1} max={999_999} onChange={setMark} />
                <div className="grid gap-4 sm:grid-cols-3">
                  <NumberInput label="Restricted" hint="minutes before close" value={restricted} min={3} onChange={setRestricted} />
                  <NumberInput label="Reduce-only" hint="minutes before close" value={reduceOnly} min={2} onChange={setReduceOnly} />
                  <NumberInput label="Hard-flat" hint="minutes before close" value={hardFlat} min={1} onChange={setHardFlat} />
                </div>
              </fieldset>
              <div>
                <p className="text-sm font-semibold">Pre-flight checks</p>
                <ul className="mt-3 space-y-2">
                  {checks.map(([pass, label]) => (
                    <li key={label} className={cn("flex items-start gap-2 text-sm", pass ? "text-muted" : "text-warning")}>
                      {pass ? <Check className="mt-0.5 size-4 shrink-0 text-long" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface-2 p-4">
              <p className="text-xs font-medium text-subtle">Resolution rules</p>
              <p className="mt-2 whitespace-pre-line text-sm text-muted">{detail.rules || "No detailed resolution rules were returned by the provider."}</p>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4">
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-signal)]" checked={liquidityConfirmed} onChange={(e) => setLiquidityConfirmed(e.target.checked)} />
              <span>
                <span className="block text-sm font-medium">Local liquidity is configured</span>
                <span className="mt-0.5 block text-sm text-muted">I checked the Moxie matcher can quote this market. Panta’s index is not executable depth.</span>
              </span>
            </label>

            <div className="flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p className="inline-flex items-center gap-1.5 text-xs font-medium text-subtle"><LockKeyhole className="size-3.5" aria-hidden="true" /> Required authority</p>
                <p className="mt-1 font-mono text-foreground" title={config.adminAddress}>{short(config.adminAddress)}</p>
                <p className={cn("mt-0.5 text-xs", authorityMatch ? "text-long" : "text-subtle")}>
                  {!activeAddress ? "Connect the authority wallet" : authorityMatch ? "Authority verified" : `Connected: ${short(activeAddress)}`}
                </p>
              </div>
              <Button disabled={!canActivate} loading={loading} onClick={activate}>
                <ShieldCheck className="size-4" aria-hidden="true" /> Review & sign activation
              </Button>
            </div>

            {error ? <Alert tone="error" title="Activation not submitted">{error}</Alert> : null}
            {signature ? (
              <Alert tone="success" title="Market activated">
                <a className="inline-flex items-center gap-1 underline-offset-2 hover:underline" href={`https://explorer.solana.com/tx/${signature}?cluster=${config.cluster}`} target="_blank" rel="noreferrer">
                  View transaction <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              </Alert>
            ) : null}
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

function NumberInput({ label, hint, value, min, max, onChange }: { label: string; hint: string; value: number; min?: number; max?: number; onChange: (value: number) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-muted">{label}</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1.5 h-10 w-full rounded-md border border-border-strong bg-surface px-3 font-mono text-sm text-foreground outline-none focus:border-signal"
      />
      <p className="mt-1 text-xs text-subtle">{hint}</p>
    </div>
  );
}
