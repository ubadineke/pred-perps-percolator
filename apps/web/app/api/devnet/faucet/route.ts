import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";

// Devnet-only faucet for test users, funded by the local operator keypair (SOLANA_KEYPAIR_PATH or
// ~/.config/solana/id.json, which is also the mock USDC mint authority).
//   { address, asset: "usdc", amountE6 } → mints mock USDC (up to 10,000 per request)
//   { address, asset: "sol" }            → sends 0.1 devnet SOL for account rent and fees

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const RENT_SYSVAR = new PublicKey("SysvarRent111111111111111111111111111111111");

const MAX_USDC_E6 = 10_000_000_000; // 10,000 mock USDC
const USDC_COOLDOWN_MS = 10_000;
const SOL_GRANT_LAMPORTS = Math.round(0.1 * LAMPORTS_PER_SOL);
const SOL_ONLY_BELOW_LAMPORTS = Math.round(0.05 * LAMPORTS_PER_SOL);
const SOL_COOLDOWN_MS = 60 * 60_000;

const lastGrant = new Map<string, number>();

const u64 = (value: bigint) => {
  const data = Buffer.alloc(8);
  data.writeBigUInt64LE(value);
  return data;
};

async function operator() {
  // Hosted deployments pass the keypair JSON directly; local runs read the file.
  const inline = process.env.SOLANA_KEYPAIR?.trim();
  const path = process.env.SOLANA_KEYPAIR_PATH ?? `${homedir()}/.config/solana/id.json`;
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(inline || (await readFile(path, "utf8"))) as number[]));
}

function rateLimited(key: string, cooldownMs: number) {
  const last = lastGrant.get(key) ?? 0;
  return Date.now() - last < cooldownMs;
}

export async function POST(request: Request) {
  try {
    if ((process.env.MOXIE_CLUSTER ?? "devnet") !== "devnet") {
      return Response.json({ error: "The faucet is only enabled on devnet." }, { status: 403 });
    }
    const body = (await request.json()) as { address?: string; asset?: "usdc" | "sol"; amountE6?: number };
    const owner = new PublicKey(body.address ?? "");
    const asset = body.asset ?? "usdc";
    const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
    const payer = await operator();

    if (asset === "sol") {
      const key = `sol:${owner.toBase58()}`;
      if (rateLimited(key, SOL_COOLDOWN_MS)) return Response.json({ error: "Devnet SOL was already sent to this wallet in the last hour." }, { status: 429 });
      const balance = await connection.getBalance(owner, "confirmed");
      if (balance >= SOL_ONLY_BELOW_LAMPORTS) return Response.json({ error: "This wallet already has enough devnet SOL." }, { status: 400 });
      const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: owner, lamports: SOL_GRANT_LAMPORTS }));
      const signature = await connection.sendTransaction(tx, [payer], { skipPreflight: false });
      await connection.confirmTransaction(signature, "confirmed");
      lastGrant.set(key, Date.now());
      return Response.json({ signature, lamports: SOL_GRANT_LAMPORTS });
    }

    const key = `usdc:${owner.toBase58()}`;
    if (rateLimited(key, USDC_COOLDOWN_MS)) return Response.json({ error: "Wait ten seconds before requesting more test USDC." }, { status: 429 });
    const amount = BigInt(Math.min(Math.max(Math.trunc(body.amountE6 ?? 0), 1), MAX_USDC_E6));
    const mint = new PublicKey(process.env.MOXIE_USDC_MINT ?? "");
    const [ata] = PublicKey.findProgramAddressSync([owner.toBytes(), TOKEN_PROGRAM.toBytes(), mint.toBytes()], ATA_PROGRAM);
    const tx = new Transaction();
    if (!(await connection.getAccountInfo(ata, "confirmed"))) {
      tx.add(
        new TransactionInstruction({
          programId: ATA_PROGRAM,
          keys: [
            { pubkey: payer.publicKey, isSigner: true, isWritable: true },
            { pubkey: ata, isSigner: false, isWritable: true },
            { pubkey: owner, isSigner: false, isWritable: false },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
            { pubkey: RENT_SYSVAR, isSigner: false, isWritable: false },
          ],
          data: Buffer.alloc(0),
        }),
      );
    }
    tx.add(
      new TransactionInstruction({
        programId: TOKEN_PROGRAM,
        keys: [
          { pubkey: mint, isSigner: false, isWritable: true },
          { pubkey: ata, isSigner: false, isWritable: true },
          { pubkey: payer.publicKey, isSigner: true, isWritable: false },
        ],
        data: Buffer.concat([Buffer.from([7]), u64(amount)]), // SPL Token MintTo
      }),
    );
    const signature = await connection.sendTransaction(tx, [payer], { skipPreflight: false });
    await connection.confirmTransaction(signature, "confirmed");
    lastGrant.set(key, Date.now());
    return Response.json({ signature, tokenAccount: ata.toBase58(), amountE6: amount.toString() });
  } catch (cause) {
    return Response.json({ error: cause instanceof Error ? cause.message : "Devnet faucet failed." }, { status: 400 });
  }
}
