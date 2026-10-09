"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, PublicKey, type Transaction } from "@solana/web3.js";
import { getPortfolio, getPortfolioByOwner, NotIndexedError, type ApiPortfolio, type ApiPosition } from "@/lib/api";
import { friendlyError, type TxAction } from "@/lib/errors";
import { usdToAtoms } from "@/lib/format";
import {
  associatedTokenAddress,
  createPortfolioTx,
  depositTx,
  isConfigured,
  limitFor,
  ownerHex,
  quoteMatcher,
  tradeTx,
  withdrawTx,
  type ExecutionConfig,
} from "@/lib/moxie-client";
import { usePrivyWalletState } from "@/components/wallet-providers";

const POLL_MS = 4_000;

export type PortfolioState = "disconnected" | "loading" | "none" | "pending" | "ready" | "unavailable";
export type TxNotice = { tone: "success" | "error"; message: string; signature?: string };
export type TradableMarket = { assetIndex: number; marketId: string; mark: number };

/**
 * The connected wallet's Moxie account on the configured market group: portfolio (from the indexer),
 * wallet USDC balance (from chain), and every account action with consistent pending/error handling.
 */
export function useMoxieAccount(config: ExecutionConfig) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const privy = usePrivyWalletState();
  const address = wallet.publicKey?.toBase58() || privy.address || "";
  const configured = isConfigured(config);

  const [portfolio, setPortfolio] = useState<ApiPortfolio | null>(null);
  const [state, setState] = useState<PortfolioState>(address ? "loading" : "disconnected");
  const [walletUsdc, setWalletUsdc] = useState<number | null>(null);
  const [busy, setBusy] = useState<TxAction | null>(null);
  const [notice, setNotice] = useState<TxNotice | null>(null);
  const pendingPortfolio = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address) {
      setPortfolio(null);
      setState("disconnected");
      setWalletUsdc(null);
      return;
    }
    try {
      const next = await getPortfolioByOwner(ownerHex(address));
      setPortfolio(next);
      setState("ready");
      pendingPortfolio.current = null;
    } catch (cause) {
      if (cause instanceof NotIndexedError) {
        setPortfolio(null);
        setState(pendingPortfolio.current ? "pending" : "none");
      } else {
        setState((current) => (current === "ready" ? current : "unavailable"));
      }
    }
    if (config.usdcMint) {
      try {
        const ata = associatedTokenAddress(new PublicKey(address), new PublicKey(config.usdcMint));
        const balance = await connection.getTokenAccountBalance(ata, "confirmed");
        setWalletUsdc(Number(balance.value.uiAmount ?? 0));
      } catch {
        setWalletUsdc(0); // no token account yet
      }
    }
  }, [address, config.usdcMint, connection]);

  useEffect(() => {
    setState(address ? "loading" : "disconnected");
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [address, refresh]);

  const send = useCallback(
    async (tx: Transaction, signers: Keypair[] = []): Promise<string> => {
      if (!address) throw new Error("Connect a wallet first.");
      const latest = await connection.getLatestBlockhash("confirmed");
      tx.feePayer = new PublicKey(address);
      tx.recentBlockhash = latest.blockhash;
      if (signers.length) tx.partialSign(...signers);
      let signature: string;
      if (wallet.publicKey && wallet.sendTransaction) {
        signature = await wallet.sendTransaction(tx, connection, { signers, skipPreflight: false });
      } else if (privy.sendTransaction) {
        signature = await privy.sendTransaction(tx.serialize({ requireAllSignatures: false }));
      } else {
        throw new Error("The connected wallet cannot submit Solana transactions.");
      }
      const result = await connection.confirmTransaction({ ...latest, signature }, "confirmed");
      if (result.value.err) throw new Error(`Transaction failed on-chain: ${JSON.stringify(result.value.err)}`);
      return signature;
    },
    [address, connection, privy, wallet],
  );

  /** Runs one action: tracks busy state, maps errors to plain language, refreshes afterwards. */
  const run = useCallback(
    async (action: TxAction, task: () => Promise<{ message: string; signature?: string } | void>) => {
      setBusy(action);
      setNotice(null);
      try {
        const result = await task();
        if (result) setNotice({ tone: "success", ...result });
        setTimeout(() => void refresh(), 1_500);
        return true;
      } catch (cause) {
        const message = friendlyError(cause, action);
        if (message) setNotice({ tone: "error", message });
        return false;
      } finally {
        setBusy(null);
      }
    },
    [refresh],
  );

  const createPortfolio = useCallback(
    () =>
      run("create", async () => {
        const account = Keypair.generate();
        const rent = await connection.getMinimumBalanceForRentExemption(config.portfolioAccountSize);
        const signature = await send(createPortfolioTx(config, new PublicKey(address), account.publicKey, rent), [account]);
        pendingPortfolio.current = account.publicKey.toBase58();
        setState("pending");
        return { message: "Portfolio created.", signature };
      }),
    [address, config, connection, run, send],
  );

  const requestTestUsdc = useCallback(
    (amountUsd: number) =>
      run("faucet", async () => {
        const response = await fetch("/api/devnet/faucet", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ address, amountE6: Number(usdToAtoms(amountUsd)) }),
        });
        const body = (await response.json()) as { error?: string; signature?: string };
        if (!response.ok) throw new Error(body.error ?? "The devnet faucet is unavailable.");
        return { message: `${amountUsd.toLocaleString()} test USDC sent to your wallet.`, signature: body.signature };
      }),
    [address, run],
  );

  const deposit = useCallback(
    (amountUsd: number) =>
      run("deposit", async () => {
        if (!portfolio) throw new Error("Create a portfolio first.");
        const signature = await send(depositTx(config, new PublicKey(address), portfolio, usdToAtoms(amountUsd)));
        return { message: `Deposited ${amountUsd.toLocaleString()} USDC.`, signature };
      }),
    [address, config, portfolio, run, send],
  );

  const withdraw = useCallback(
    (amountUsd: number) =>
      run("withdraw", async () => {
        if (!portfolio) throw new Error("Create a portfolio first.");
        const signature = await send(withdrawTx(config, new PublicKey(address), portfolio, usdToAtoms(amountUsd)));
        return { message: `Withdrew ${amountUsd.toLocaleString()} USDC to your wallet.`, signature };
      }),
    [address, config, portfolio, run, send],
  );

  /** Submits a market order of `sizeQ` (positive = long) with quote-based price protection. */
  const submitOrder = useCallback(
    async (action: "trade" | "close", market: TradableMarket, sizeQ: bigint) =>
      run(action, async () => {
        if (!portfolio) throw new Error("Create a portfolio first.");
        const [lp, matcher] = await Promise.all([getPortfolio(config.lpPortfolio), connection.getAccountInfo(new PublicKey(config.matcherContext), "confirmed")]);
        if (!matcher) throw new Error("The liquidity provider is not available.");
        const markE6 = BigInt(Math.round(market.mark * 10_000));
        const quote = quoteMatcher(matcher.data, markE6, sizeQ);
        const signature = await send(tradeTx(config, new PublicKey(address), portfolio, lp, market, sizeQ, limitFor(quote, sizeQ)));
        const side = sizeQ > 0n ? "Long" : "Short";
        const price = (Number(quote) / 10_000).toFixed(1);
        return { message: action === "close" ? `Position closed near ${price}¢.` : `${side} filled near ${price}¢.`, signature };
      }),
    [address, config, connection, portfolio, run, send],
  );

  const trade = useCallback((market: TradableMarket, sizeQ: bigint) => submitOrder("trade", market, sizeQ), [submitOrder]);
  const close = useCallback((market: TradableMarket, position: ApiPosition) => submitOrder("close", market, -BigInt(position.sizeQ)), [submitOrder]);

  return {
    address,
    configured,
    portfolio,
    state,
    walletUsdc,
    busy,
    notice,
    dismissNotice: () => setNotice(null),
    refresh,
    createPortfolio,
    requestTestUsdc,
    deposit,
    withdraw,
    trade,
    close,
  };
}

export type MoxieAccount = ReturnType<typeof useMoxieAccount>;
