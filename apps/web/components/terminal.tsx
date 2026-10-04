"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { ComputeBudgetProgram, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Clock3, ExternalLink, Info, Settings2, ShieldCheck } from "lucide-react";
import { createPortfolioInstruction, depositInstruction, tradeInstruction, type MoxieInstruction } from "../../../packages/sdk/src/instructions";
import { getMarket, getMarketPrices, getMarketTrades, getPortfolio, getPortfolioByOwner, type ApiPortfolio, type ApiPricePoint, type ApiTrade } from "@/lib/api";
import type { Market } from "@/lib/markets";
import { usePrivyWalletState } from "./wallet-providers";

type ExecutionConfig={cluster:string;percolatorProgramId:string;marketAccount:string;usdcMint:string;collateralVault:string;lpPortfolio:string;matcherProgramId:string;matcherContext:string;matcherDelegate:string;portfolioAccountSize:number;maxLeverage:number};
const TOKEN_PROGRAM="TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ATA_PROGRAM="ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
const instruction=(x:MoxieInstruction)=>new TransactionInstruction({programId:new PublicKey(x.programAddress),keys:x.accounts.map(a=>({pubkey:new PublicKey(a.address),isSigner:a.isSigner,isWritable:a.isWritable})),data:Buffer.from(x.data)});
const u32=(v:DataView,o:number)=>BigInt(v.getUint32(o,true));
const u128=(v:DataView,o:number)=>v.getBigUint64(o,true)|(v.getBigUint64(o+8,true)<<64n);
const i128=(v:DataView,o:number)=>{const x=u128(v,o);return x&(1n<<127n)?x-(1n<<128n):x};
const money=(value:string|bigint)=>`$${(Number(value)/1_000_000).toLocaleString(undefined,{maximumFractionDigits:2})}`;

function linePath(points:number[],width=650,height=250){
  if(!points.length)return "";const min=Math.min(...points),max=Math.max(...points),span=Math.max(max-min,1);
  return points.map((p,i)=>`${i?"L":"M"}${(i/Math.max(points.length-1,1))*width} ${height-18-((p-min)/span)*(height-36)}`).join(" ");
}

function quoteMatcher(data:Uint8Array,oracle:bigint,requested:bigint){
  const v=new DataView(data.buffer,data.byteOffset,data.byteLength),s=64;
  if(data.length!==320||data[s+8]!==0)throw new Error("The local matcher is paused or unavailable.");
  const base=u32(v,s+48),max=u32(v,s+52),sizeCoefficient=u32(v,s+56),skewCoefficient=u32(v,s+60),charges=u32(v,s+64)+u32(v,s+68)+u32(v,s+144)+u32(v,s+148),epsilon=u32(v,s+152);
  const maxFill=u128(v,s+96),capacity=u128(v,s+112),inventory=i128(v,s+128),abs=requested<0n?-requested:requested;
  if(abs>maxFill||(inventory-requested<0n?requested-inventory:inventory-requested)>capacity)throw new Error("Order exceeds current matcher capacity.");
  const inventoryAdjustment=(((-inventory*2n)+requested)*skewCoefficient)/(capacity*2n);
  const sizeAdjustment=(abs*sizeCoefficient+capacity-1n)/capacity;
  const raw=inventoryAdjustment+(base+charges+sizeAdjustment)*(requested>0n?1n:-1n);
  const bounded=raw < -max ? -max : raw > max ? max : raw;
  const price=oracle+bounded,upper=1_000_000n-epsilon;
  return price<epsilon?epsilon:price>upper?upper:price;
}

export function Terminal({market:initialMarket,markets,execution}:{market:Market;markets:Market[];execution:ExecutionConfig}){
  const {connection}=useConnection(),wallet=useWallet(),privy=usePrivyWalletState();
  const [market,setMarket]=useState(initialMarket),[side,setSide]=useState<"long"|"short">("long"),[collateral,setCollateral]=useState(25),[leverage,setLeverage]=useState(1);
  const [portfolio,setPortfolio]=useState<ApiPortfolio|null>(null),[lp,setLp]=useState<ApiPortfolio|null>(null),[prices,setPrices]=useState<ApiPricePoint[]>([]),[trades,setTrades]=useState<ApiTrade[]>([]);
  const [activity,setActivity]=useState<"position"|"fills">("position");
  const [portfolioPending,setPortfolioPending]=useState<string|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[error,setError]=useState("");
  const externalAddress=wallet.publicKey?.toBase58()??"",activeAddress=externalAddress||privy.address||"",ownerHex=activeAddress?hex(new PublicKey(activeAddress).toBytes()):"";
  const configured=Object.entries(execution).filter(([k])=>k!=="cluster"&&k!=="maxLeverage"&&k!=="portfolioAccountSize").every(([,v])=>Boolean(v));

  const refresh=useCallback(async()=>{
    const results=await Promise.allSettled([getMarket(initialMarket.address),getMarketPrices(initialMarket.address),getMarketTrades(initialMarket.address),getPortfolio(execution.lpPortfolio),ownerHex?getPortfolioByOwner(ownerHex):Promise.resolve(null)]);
    if(results[0].status==="fulfilled")setMarket(results[0].value);if(results[1].status==="fulfilled")setPrices(results[1].value);if(results[2].status==="fulfilled")setTrades(results[2].value);if(results[3].status==="fulfilled")setLp(results[3].value);if(results[4].status==="fulfilled")setPortfolio(results[4].value);else if(ownerHex)setPortfolio(null);
  },[initialMarket.address,execution.lpPortfolio,ownerHex]);
  useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),3_000);return()=>clearInterval(timer)},[refresh]);

  const send=useCallback(async(tx:Transaction,extra:Keypair[]=[]):Promise<string>=>{
    if(!activeAddress)throw new Error("Connect a wallet first.");const payer=new PublicKey(activeAddress),latest=await connection.getLatestBlockhash("confirmed");tx.feePayer=payer;tx.recentBlockhash=latest.blockhash;if(extra.length)tx.partialSign(...extra);
    let signature:string;if(wallet.publicKey&&wallet.sendTransaction)signature=await wallet.sendTransaction(tx,connection,{signers:extra,skipPreflight:false});else if(privy.sendTransaction)signature=await privy.sendTransaction(tx.serialize({requireAllSignatures:false}));else throw new Error("The connected wallet cannot submit Solana transactions.");
    await connection.confirmTransaction({...latest,signature},"confirmed");return signature;
  },[activeAddress,connection,privy,wallet]);

  async function createPortfolio(){
    if(!configured||!activeAddress)return;setBusy(true);setError("");setNotice("");try{const account=Keypair.generate(),rent=await connection.getMinimumBalanceForRentExemption(execution.portfolioAccountSize),owner=new PublicKey(activeAddress);
      const tx=new Transaction().add(SystemProgram.createAccount({fromPubkey:owner,newAccountPubkey:account.publicKey,lamports:rent,space:execution.portfolioAccountSize,programId:new PublicKey(execution.percolatorProgramId)}),instruction(createPortfolioInstruction({program:execution.percolatorProgramId,owner:activeAddress,market:execution.marketAccount,portfolio:account.publicKey.toBase58()})));
      const signature=await send(tx,[account]);setPortfolioPending(account.publicKey.toBase58());setNotice(`Portfolio created · ${signature.slice(0,8)}…`);setTimeout(()=>void refresh(),2500);
    }catch(cause){setError(cause instanceof Error?cause.message:"Portfolio creation failed.")}finally{setBusy(false)}}

  async function fund(){
    if(!portfolio||!activeAddress)return;setBusy(true);setError("");setNotice("");try{const response=await fetch("/api/devnet/faucet",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({address:activeAddress,amountE6:100_000_000})});const minted=await response.json();if(!response.ok)throw new Error(minted.error??"Devnet faucet failed.");
      const owner=new PublicKey(activeAddress),mint=new PublicKey(execution.usdcMint),ata=PublicKey.findProgramAddressSync([owner.toBytes(),new PublicKey(TOKEN_PROGRAM).toBytes(),mint.toBytes()],new PublicKey(ATA_PROGRAM))[0];
      const tx=new Transaction().add(instruction(depositInstruction({program:execution.percolatorProgramId,owner:activeAddress,market:execution.marketAccount,portfolio:portfolio.address,sourceToken:ata.toBase58(),vault:execution.collateralVault,tokenProgram:TOKEN_PROGRAM,portfolioId:BigInt(portfolio.portfolioId),sequence:BigInt(portfolio.sequence),amount:100_000_000n})));
      const signature=await send(tx);setNotice(`100 devnet USDC deposited · ${signature.slice(0,8)}…`);setTimeout(()=>void refresh(),2500);
    }catch(cause){setError(cause instanceof Error?cause.message:"Deposit failed.")}finally{setBusy(false)}}

  async function submitTrade(){
    if(!portfolio||!lp||!activeAddress)return;setBusy(true);setError("");setNotice("");try{const mark=BigInt(Math.round(market.mark*10_000)),notional=BigInt(Math.round(collateral*leverage*1_000_000));if(mark<=0n)throw new Error("No valid mark is available.");
      const magnitude=(notional*1_000_000n)/mark,sizeQ=side==="long"?magnitude:-magnitude,matcher=await connection.getAccountInfo(new PublicKey(execution.matcherContext),"confirmed");if(!matcher)throw new Error("Matcher context was not found.");const quote=quoteMatcher(matcher.data,mark,sizeQ),slippage=20_000n,limit=side==="long"?quote+slippage:quote-slippage;
      const tx=new Transaction().add(ComputeBudgetProgram.requestHeapFrame({bytes:128*1024}),ComputeBudgetProgram.setComputeUnitLimit({units:1_400_000}),instruction(tradeInstruction({program:execution.percolatorProgramId,traderAuthority:activeAddress,market:execution.marketAccount,traderPortfolio:portfolio.address,lpPortfolio:execution.lpPortfolio,matcherProgram:execution.matcherProgramId,matcherContext:execution.matcherContext,matcherDelegate:execution.matcherDelegate,traderPortfolioId:BigInt(portfolio.portfolioId),traderPositionEpoch:BigInt(portfolio.positionEpoch),lpPortfolioId:BigInt(lp.portfolioId),lpPositionEpoch:BigInt(lp.positionEpoch),lpMatcherSequence:BigInt(lp.sequence),assetIndex:market.assetIndex,marketId:BigInt(market.marketId),sizeQ,feeBps:30n,limitPriceE6:limit<1n?1n:limit>999_999n?999_999n:limit})));
      const signature=await send(tx);setNotice(`${side.toUpperCase()} filled near ${(Number(quote)/10_000).toFixed(2)}¢ · ${signature.slice(0,8)}…`);setTimeout(()=>void refresh(),2500);
    }catch(cause){setError(cause instanceof Error?cause.message:"Trade failed.")}finally{setBusy(false)}}

  const position=collateral*leverage,chartMark=prices.length?prices.map(p=>Number(p.markE6)/10_000):[market.mark],chartIndex=prices.length?prices.map(p=>Number(p.indexE6)/10_000):[market.index],chartLocal=prices.length?prices.map(p=>Number(p.localMidE6??p.markE6)/10_000):[market.moxie],markPath=linePath(chartMark),indexPath=linePath(chartIndex),localPath=linePath(chartLocal),openPosition=portfolio?.positions.find(p=>p.assetIndex===market.assetIndex&&p.marketId===market.marketId);
  return <div className="terminal-layout">
    <aside className="market-rail"><div className="rail-search">MARKETS <span>LIVE</span></div>{markets.map(item=><Link href={`/trade/${item.slug}`} className={item.slug===market.slug?"active":""} key={item.slug}><span><i/>{item.short}</span><b>{item.moxie.toFixed(1)}¢</b><em>{item.provider.toUpperCase()}</em></Link>)}</aside>
    <section className="trade-workspace">
      <div className="trade-titlebar"><div><span className="market-icon">{market.short.slice(0,2)}</span><div><p>{market.category} · {market.providerLabel} <ExternalLink size={11}/></p><h1>{market.question}</h1></div></div><dl><div><dt>MOXIE</dt><dd>{market.moxie.toFixed(1)}¢</dd></div><div><dt>INDEX</dt><dd>{market.index.toFixed(1)}¢</dd></div><div><dt>MARK</dt><dd>{market.mark.toFixed(1)}¢</dd></div><div><dt>LOCKS IN</dt><dd className="warning"><Clock3 size={12}/>{market.lock}</dd></div></dl></div>
      <div className="chart-panel"><div className="chart-toolbar"><div><button className="active" type="button">Price layers</button></div><div><button className="active" type="button">LIVE</button><button aria-label="Chart settings" type="button"><Settings2 size={15}/></button></div></div><div className="chart-area"><div className="chart-price"><strong>{market.mark.toFixed(1)}¢</strong><span>{prices.length} authenticated observations</span></div><svg viewBox="0 0 650 250" preserveAspectRatio="none" role="img" aria-label={`${market.short} protected mark, local midpoint and index chart`}><path className="index-path" d={indexPath}/><path className="local-path" d={localPath}/><path className="market-path" d={markPath}/></svg><div className="x-axis"><span>EARLIER</span><span>ON-CHAIN OBSERVATIONS</span><span>NOW</span></div></div><div className="chart-footer"><span><i className="moxie-dot"/> PROTECTED MARK {market.mark.toFixed(1)}</span><span><i className="local-dot"/> LOCAL MID {chartLocal.at(-1)?.toFixed(1)}</span><span><i className="index-dot"/> PANTA {market.index.toFixed(1)}</span><em>REFRESHING EVERY 3S</em></div></div>
      <div className="lower-panel"><div className="panel-tabs"><button className={activity==="position"?"active":""} onClick={()=>setActivity("position")} type="button">Position <span>{openPosition?1:0}</span></button><button className={activity==="fills"?"active":""} onClick={()=>setActivity("fills")} type="button">Recent fills <span>{trades.length}</span></button></div>{activity==="fills"?<div className="trade-tape">{trades.slice(0,5).map(trade=><a href={`https://explorer.solana.com/tx/${trade.signature}?cluster=${execution.cluster}`} target="_blank" rel="noreferrer" key={`${trade.signature}:${trade.instructionIndex}`}><b>{BigInt(trade.data.sizeQ??"0")>=0n?"LONG":"SHORT"}</b><span>{(Math.abs(Number(trade.data.executedSizeQ??trade.data.sizeQ??0))/1_000_000).toFixed(2)} contracts</span><span>fill {(Number(trade.data.executionPriceE6??trade.data.limitPriceE6??0)/10_000).toFixed(2)}¢</span><em>{trade.signature.slice(0,6)}…</em></a>)}</div>:openPosition?<div className="position-row"><span><i className="position-side">{openPosition.side==="long"?"L":"S"}</i>{market.short}</span><span><small>SIZE</small>{Number(openPosition.sizeQ)/1_000_000}</span><span><small>ENTRY NOTIONAL</small>{money(openPosition.entryNotional)}</span><span><small>EQUITY</small>{money(portfolio!.health.equity)}</span><span><small>HEALTH</small>{portfolio!.health.valid?"Healthy":"At risk"}</span></div>:<div className="empty-activity"><div><b>{portfolio?"No open position":"No portfolio loaded"}</b><span>{portfolio?"A confirmed fill will appear here.":"Connect, create and fund a portfolio to trade."}</span></div></div>}</div>
    </section>
    <aside className="order-ticket"><div className="side-tabs"><button className={side==="long"?"long active":"long"} onClick={()=>setSide("long")} type="button">LONG</button><button className={side==="short"?"short active":"short"} onClick={()=>setSide("short")} type="button">SHORT</button></div><div className="order-types"><button className="active" type="button">Market</button></div>
      <div className="balance-line"><span>Portfolio collateral</span><b>{portfolio?money(portfolio.capital):activeAddress?"Not created":"Wallet disconnected"}</b></div>
      {!portfolio?<button className="setup-action" disabled={!activeAddress||busy} type="button" onClick={createPortfolio}>{busy?"Submitting…":portfolioPending?"Waiting for indexer…":"Create portfolio"}</button>:BigInt(portfolio.capital)===0n?<button className="setup-action" disabled={busy||execution.cluster!=="devnet"} type="button" onClick={fund}>{busy?"Funding…":"Fund 100 devnet USDC"}</button>:null}
      <label className="ticket-label" htmlFor="collateral">COLLATERAL</label><div className="amount-field"><input id="collateral" type="number" min="1" value={collateral} onChange={e=>setCollateral(Math.max(1,Number(e.target.value)))}/><b>USDC</b></div><div className="quick-percent"><button onClick={()=>setCollateral(10)} type="button">$10</button><button onClick={()=>setCollateral(25)} type="button">$25</button><button onClick={()=>setCollateral(50)} type="button">$50</button><button onClick={()=>setCollateral(100)} type="button">$100</button></div>
      <label className="ticket-label" htmlFor="leverage">LEVERAGE <b>{leverage}×</b></label><input className="leverage-slider" id="leverage" type="range" min="1" max={execution.maxLeverage} step="1" value={leverage} onChange={e=>setLeverage(Number(e.target.value))}/><div className="leverage-labels"><span>1×</span><span>Market maximum {execution.maxLeverage}×</span></div>
      <div className="order-summary"><div><span>Position notional</span><b>${position.toFixed(2)}</b></div><div><span>Current mark <Info size={12}/></span><b>{market.mark.toFixed(2)}¢</b></div><div><span>Limit protection</span><b>2.00¢</b></div><div><span>Trading fee</span><b>${(position*.003).toFixed(2)}</b></div></div><div className="risk-note"><ShieldCheck size={16}/><span><b>Protected mark active</b>Execution uses the local matcher; margin uses the indexed mark.</span></div>
      <button className={`review-order ${side}`} disabled={!portfolio||BigInt(portfolio.capital)===0n||busy||market.status>2} type="button" onClick={submitTrade}>{busy?"Submitting…":`${side==="long"?"Long":"Short"} ${market.short}`}</button>{error?<p className="order-notice error" role="alert">{error}</p>:null}{notice?<p className="order-notice success" role="status">{notice}</p>:null}
    </aside>
  </div>;
}
