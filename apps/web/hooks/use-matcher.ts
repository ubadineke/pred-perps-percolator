"use client";

import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

/** Live matcher context account data, for previewing fills before signing. Refreshes every 10s. */
export function useMatcherData(matcherContext: string) {
  const { connection } = useConnection();
  const [data, setData] = useState<Uint8Array | null>(null);

  useEffect(() => {
    if (!matcherContext) return;
    let active = true;
    const load = async () => {
      try {
        const account = await connection.getAccountInfo(new PublicKey(matcherContext), "confirmed");
        if (active) setData(account ? new Uint8Array(account.data) : null);
      } catch {
        // Keep the last known data; the order is re-quoted at submit time anyway.
      }
    };
    void load();
    const timer = setInterval(() => void load(), 10_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [connection, matcherContext]);

  return data;
}
