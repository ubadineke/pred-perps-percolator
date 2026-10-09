"use client";

import { ExternalLink, Loader2, WalletCards } from "lucide-react";
import type { MoxieAccount, TxNotice } from "@/hooks/use-moxie-account";
import { Alert } from "../ui/primitives";
import { Button } from "../ui/button";
import { WalletControl } from "../wallet-control";

/**
 * Renders the single next step a wallet needs before it can trade (connect → create → wait),
 * or nothing once the portfolio exists.
 */
export function AccountGate({ account }: { account: MoxieAccount }) {
  if (!account.configured) {
    return <Alert tone="warning" title="Trading isn’t configured">This deployment is missing its market settings.</Alert>;
  }
  switch (account.state) {
    case "disconnected":
      return (
        <GateCard title="Connect a wallet to trade" description="Moxie works with any Solana wallet. Every transaction asks for your approval first.">
          <WalletControl />
        </GateCard>
      );
    case "loading":
      return (
        <GateCard title="Loading your account…">
          <Loader2 className="size-5 animate-spin text-subtle" aria-hidden="true" />
        </GateCard>
      );
    case "none":
      return (
        <GateCard
          icon
          title="Create your trading account"
          description="One portfolio holds your collateral and positions across every market. Setup costs about 0.07 SOL in refundable account rent."
        >
          <Button className="w-full" loading={account.busy === "create"} onClick={account.createPortfolio}>
            Create portfolio
          </Button>
        </GateCard>
      );
    case "pending":
      return (
        <GateCard title="Setting up your portfolio…" description="Your portfolio was created. It appears here within a few seconds.">
          <Loader2 className="size-5 animate-spin text-subtle" aria-hidden="true" />
        </GateCard>
      );
    case "unavailable":
      return <Alert tone="warning" title="Account data is unavailable">The market data service isn’t responding. Retrying automatically.</Alert>;
    default:
      return null;
  }
}

function GateCard({ title, description, icon, children }: { title: string; description?: string; icon?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border-strong px-5 py-8 text-center">
      {icon ? (
        <span className="grid size-10 place-items-center rounded-full border border-border text-signal">
          <WalletCards className="size-5" aria-hidden="true" />
        </span>
      ) : null}
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

/** Result of the last account action, with an explorer link when there is a transaction. */
export function TxNoticeView({ notice, cluster, onDismiss }: { notice: TxNotice | null; cluster: string; onDismiss?: () => void }) {
  if (!notice) return null;
  return (
    <Alert tone={notice.tone === "success" ? "success" : "error"}>
      <span className="text-foreground">{notice.message}</span>
      <span className="mt-1 flex items-center gap-3">
        {notice.signature ? (
          <a className="inline-flex items-center gap-1 text-xs font-medium text-muted underline-offset-2 hover:text-foreground hover:underline" href={`https://explorer.solana.com/tx/${notice.signature}?cluster=${cluster}`} target="_blank" rel="noreferrer">
            View transaction <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        ) : null}
        {onDismiss ? (
          <button type="button" onClick={onDismiss} className="text-xs font-medium text-muted hover:text-foreground">
            Dismiss
          </button>
        ) : null}
      </span>
    </Alert>
  );
}
