export type TradeRequest = {
  traderPortfolioId: bigint; traderPositionEpoch: bigint;
  lpPortfolioId: bigint; lpPositionEpoch: bigint; lpMatcherSequence: bigint;
  assetIndex: number; marketId: bigint; sizeQ: bigint; feeBps: bigint;
  limitPriceE6: bigint; backingFeeCapBps?: number;
};
export type MatcherQuote={priceE6:bigint;feeBps:bigint;expiresAtSlot:bigint;matcherSequence:bigint};

const out = (tag: number, length: number) => { const b = new Uint8Array(length); b[0] = tag; return b; };
const view = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);
const u16 = (v: DataView, o: number, x: number) => v.setUint16(o, x, true);
const u64 = (v: DataView, o: number, x: bigint) => v.setBigUint64(o, x, true);
const i128 = (v: DataView, o: number, x: bigint) => { const n = x < 0n ? (1n << 128n) + x : x; u64(v,o,n & ((1n<<64n)-1n)); u64(v,o+8,n>>64n); };
const u128 = (v: DataView, o: number, x: bigint) => { if(x<0n) throw new RangeError("negative u128"); i128(v,o,x); };

export const buildCreatePortfolioData = (): Uint8Array => Uint8Array.of(1);
export function buildDepositData(portfolioId: bigint, sequence: bigint, amount: bigint): Uint8Array {
  const b=out(3,33),v=view(b); u64(v,1,portfolioId);u64(v,9,sequence);u128(v,17,amount);return b;
}
export function buildWithdrawData(portfolioId: bigint, sequence: bigint, amount: bigint): Uint8Array {
  const b=out(4,33),v=view(b); u64(v,1,portfolioId);u64(v,9,sequence);u128(v,17,amount);return b;
}
export function buildTradeCpiData(r: TradeRequest): Uint8Array {
  if(!r.sizeQ) throw new Error("trade size cannot be zero");
  const b=out(10,100),v=view(b); let o=1;
  for(const x of [r.traderPortfolioId,r.traderPositionEpoch,r.lpPortfolioId,r.lpPositionEpoch,r.lpMatcherSequence]){u64(v,o,x);o+=8}
  u16(v,o,r.assetIndex);o+=2;u64(v,o,r.marketId);o+=8;i128(v,o,r.sizeQ);o+=16;u64(v,o,r.feeBps);o+=8;u64(v,o,r.limitPriceE6);o+=8;u16(v,o,r.backingFeeCapBps??0);return b;
}
export function quoteFromMatcher(input:{bidE6:bigint;askE6:bigint;side:"long"|"short";feeBps:bigint;expiresAtSlot:bigint;matcherSequence:bigint}):MatcherQuote{
 if(input.bidE6<=0n||input.askE6>=1_000_000n||input.bidE6>input.askE6)throw new Error("invalid matcher quote");
 return{priceE6:input.side==="long"?input.askE6:input.bidE6,feeBps:input.feeBps,expiresAtSlot:input.expiresAtSlot,matcherSequence:input.matcherSequence};
}
export function buildClosePositionData(r:Omit<TradeRequest,"sizeQ">&{openSizeQ:bigint}):Uint8Array{
 if(r.openSizeQ===0n)throw new Error("position is already flat");return buildTradeCpiData({...r,sizeQ:-r.openSizeQ});
}
export function buildPermissionlessCrankData(nowSlot: bigint, assets: readonly number[]): Uint8Array {
  if(assets.length>16) throw new Error("too many crank observations");
  const b=out(5,10+assets.length*3),v=view(b);u64(v,1,nowSlot);b[9]=assets.length;
  assets.forEach((a,i)=>{u16(v,10+i*3,a);b[12+i*3]=0});return b;
}
export const buildCloseResolvedData = (feeRatePerSlot=0n): Uint8Array => { const b=out(30,17);u128(view(b),1,feeRatePerSlot);return b; };
export function buildHardFlatData(aId:bigint,aEpoch:bigint,bId:bigint,bEpoch:bigint,assetIndex:number,marketId:bigint,reduceQ:bigint):Uint8Array{
 const b=out(69,67),v=view(b);let o=1;for(const x of[aId,aEpoch,bId,bEpoch]){u64(v,o,x);o+=8}u16(v,o,assetIndex);o+=2;u64(v,o,marketId);o+=8;u128(v,o,reduceQ);return b;
}
