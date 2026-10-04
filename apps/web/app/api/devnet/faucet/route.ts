import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const TOKEN_PROGRAM=new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),ATA_PROGRAM=new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const recent=new Map<string,number>();
const u64=(value:bigint)=>{const data=Buffer.alloc(8);data.writeBigUInt64LE(value);return data};

export async function POST(request:Request){
  try{
    if((process.env.MOXIE_CLUSTER??"devnet")!=="devnet")return Response.json({error:"The faucet is only enabled on devnet."},{status:403});
    const body=await request.json() as {address?:string;amountE6?:number},owner=new PublicKey(body.address??""),amount=BigInt(Math.min(Math.max(Math.trunc(body.amountE6??0),1),100_000_000));
    const last=recent.get(owner.toBase58())??0;if(Date.now()-last<10_000)return Response.json({error:"Wait ten seconds before requesting more devnet collateral."},{status:429});
    const path=process.env.SOLANA_KEYPAIR_PATH??`${homedir()}/.config/solana/id.json`,secret=JSON.parse(await readFile(path,"utf8")) as number[],payer=Keypair.fromSecretKey(Uint8Array.from(secret));
    const mint=new PublicKey(process.env.MOXIE_USDC_MINT??""),connection=new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL??process.env.SOLANA_RPC_URL??"https://api.devnet.solana.com","confirmed"),[ata]=PublicKey.findProgramAddressSync([owner.toBytes(),TOKEN_PROGRAM.toBytes(),mint.toBytes()],ATA_PROGRAM),tx=new Transaction();
    if(!await connection.getAccountInfo(ata,"confirmed"))tx.add(new TransactionInstruction({programId:ATA_PROGRAM,keys:[{pubkey:payer.publicKey,isSigner:true,isWritable:true},{pubkey:ata,isSigner:false,isWritable:true},{pubkey:owner,isSigner:false,isWritable:false},{pubkey:mint,isSigner:false,isWritable:false},{pubkey:SystemProgram.programId,isSigner:false,isWritable:false},{pubkey:TOKEN_PROGRAM,isSigner:false,isWritable:false},{pubkey:new PublicKey("SysvarRent111111111111111111111111111111111"),isSigner:false,isWritable:false}],data:Buffer.alloc(0)}));
    tx.add(new TransactionInstruction({programId:TOKEN_PROGRAM,keys:[{pubkey:mint,isSigner:false,isWritable:true},{pubkey:ata,isSigner:false,isWritable:true},{pubkey:payer.publicKey,isSigner:true,isWritable:false}],data:Buffer.concat([Buffer.from([7]),u64(amount)])}));
    const signature=await connection.sendTransaction(tx,[payer],{skipPreflight:false});await connection.confirmTransaction(signature,"confirmed");recent.set(owner.toBase58(),Date.now());return Response.json({signature,tokenAccount:ata.toBase58(),amountE6:amount.toString()});
  }catch(cause){return Response.json({error:cause instanceof Error?cause.message:"Devnet faucet failed."},{status:400})}
}
