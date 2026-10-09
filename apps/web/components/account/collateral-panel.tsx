"use client";

import { useState } from "react";
import { Droplets } from "lucide-react";
import type { MoxieAccount } from "@/hooks/use-moxie-account";
import { freeCollateralUsd } from "@/lib/moxie-client";
import { atomsToUsd, usd } from "@/lib/format";
import { AmountField } from "../ui/amount-field";
import { Button } from "../ui/button";
import { Segmented } from "../ui/primitives";

const TEST_USDC_AMOUNT = 1_000;

/** Deposit to / withdraw from the shared-margin portfolio, plus the devnet test-USDC faucet. */
export function CollateralPanel({ account, cluster, compact = false }: { account: MoxieAccount; cluster: string; compact?: boolean }) {
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const portfolio = account.portfolio;
  if (!portfolio) return null;

  const wallet = account.walletUsdc ?? 0;
  const deposited = atomsToUsd(portfolio.capital);
  const free = freeCollateralUsd(portfolio);
  const available = mode === "deposit" ? wallet : free;
  const value = Number(amount);
  const tooMuch = value > available + 1e-9;
  const invalid = !(value > 0) || tooMuch;
  const busy = account.busy === "deposit" || account.busy === "withdraw";
  const half = (available / 2).toFixed(2);

  async function submit() {
    const ok = mode === "deposit" ? await account.deposit(value) : await account.withdraw(value);
    if (ok) setAmount("");
  }

  return (
    <div className="space-y-4">
      {!compact ? (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-subtle">Deposited</dt>
            <dd className="mt-0.5 font-mono text-foreground">{usd(deposited)}</dd>
          </div>
          <div>
            <dt className="text-xs text-subtle">Wallet balance</dt>
            <dd className="mt-0.5 font-mono text-foreground">{account.walletUsdc === null ? "—" : usd(wallet)}</dd>
          </div>
        </dl>
      ) : null}
      <Segmented
        label="Collateral action"
        value={mode}
        onChange={(next) => {
          setMode(next);
          setAmount("");
        }}
        options={[
          { value: "deposit", label: "Deposit" },
          { value: "withdraw", label: "Withdraw" },
        ]}
        className="w-full"
      />
      <AmountField
        label={mode === "deposit" ? "Amount to deposit" : "Amount to withdraw"}
        labelAside={mode === "deposit" ? `Wallet ${usd(wallet)}` : `Free ${usd(free)}`}
        value={amount}
        onChange={setAmount}
        unit="USDC"
        max={available}
        presets={[
          { label: "50%", value: half },
          { label: "Max", value: Math.max(available - 0.005, 0).toFixed(2) },
        ]}
        error={tooMuch ? (mode === "deposit" ? "More than your wallet balance." : "More than your free collateral.") : undefined}
        hint={mode === "withdraw" ? "Collateral backing open positions can’t be withdrawn." : undefined}
      />
      <Button className="w-full" variant="secondary" disabled={invalid} loading={busy} onClick={submit}>
        {mode === "deposit" ? "Deposit USDC" : "Withdraw USDC"}
      </Button>
      {cluster === "devnet" && mode === "deposit" ? (
        <Button className="w-full" variant="ghost" size="sm" loading={account.busy === "faucet"} onClick={() => account.requestTestUsdc(TEST_USDC_AMOUNT)}>
          <Droplets className="size-3.5" aria-hidden="true" /> Get {TEST_USDC_AMOUNT.toLocaleString()} test USDC
        </Button>
      ) : null}
    </div>
  );
}
