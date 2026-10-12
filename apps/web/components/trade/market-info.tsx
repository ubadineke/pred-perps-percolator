"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight, CircleCheck, CircleAlert, CircleDashed } from "lucide-react";
import type { Market } from "@/lib/markets";
import { countdown, price, shortAddress, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

type Verification = "checking" | "match" | "mismatch" | "unavailable";

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Checks the displayed rules against the sha256 fingerprint recorded on-chain when the market was listed. */
function useRulesVerification(rules: string | null, rulesHash: string | null): Verification {
  const [state, setState] = useState<Verification>("checking");
  useEffect(() => {
    if (!rules || !rulesHash || !globalThis.crypto?.subtle) {
      setState("unavailable");
      return;
    }
    let active = true;
    sha256Hex(rules)
      .then((hash) => active && setState(hash === rulesHash.toLowerCase() ? "match" : "mismatch"))
      .catch(() => active && setState("unavailable"));
    return () => {
      active = false;
    };
  }, [rules, rulesHash]);
  return state;
}

const URL_PATTERN = /(https?:\/\/[^\s,]+)/g;

/** Rule text with its source URLs turned into links. */
function RulesText({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-line text-sm leading-6 text-muted">
      {text.split(URL_PATTERN).map((part, index) =>
        index % 2 === 1 ? (
          <a key={index} href={part} target="_blank" rel="noreferrer" className="break-all text-foreground underline underline-offset-2 hover:text-signal">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </p>
  );
}

const absoluteTime = (unixSeconds: number) =>
  new Date(unixSeconds * 1000).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" });

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="text-subtle">{label}</dt>
      <dd className="min-w-0 text-right text-foreground">{children}</dd>
    </div>
  );
}

function VerificationNote({ state }: { state: Verification }) {
  const content = {
    checking: { icon: CircleDashed, tone: "text-subtle", text: "Checking these rules against the on-chain fingerprint…" },
    match: { icon: CircleCheck, tone: "text-long", text: "Matches the rules fingerprint recorded on-chain when this market was listed. They can’t be changed afterwards." },
    mismatch: { icon: CircleAlert, tone: "text-short", text: "These rules don’t match the fingerprint recorded on-chain at listing. Check the source market before trading." },
    unavailable: { icon: CircleDashed, tone: "text-subtle", text: "The rules couldn’t be checked against the on-chain fingerprint here." },
  }[state];
  const Icon = content.icon;
  return (
    <p className={cn("flex items-start gap-2 text-xs leading-5", content.tone)}>
      <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      {content.text}
    </p>
  );
}

/** Lifecycle milestones, with the phase the market is in now highlighted. */
function Schedule({ market }: { market: Market }) {
  const now = Date.now() / 1000;
  const { restrictedAt, reduceOnlyAt, hardFlatAt } = market.schedule;
  const steps = [
    { at: restrictedAt, label: "Restricted", text: "Smaller orders only" },
    { at: reduceOnlyAt, label: "Reduce only", text: "Close or trim; no new positions" },
    { at: hardFlatAt, label: "Hard-flat", text: "Open positions closed at the protected mark" },
    { at: market.closeTime, label: "Event closes", text: "Settles from the source market’s result" },
  ].filter((step) => step.at > 0);
  if (!steps.length) return <p className="text-sm text-muted">Schedule unavailable.</p>;
  const nextIndex = steps.findIndex((step) => step.at > now);
  return (
    <ol className="space-y-2.5">
      {steps.map((step, index) => {
        const passed = step.at <= now;
        const next = index === nextIndex;
        return (
          <li key={step.label} className="flex items-start gap-3 text-sm">
            <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", passed ? "bg-subtle" : next ? "bg-warning" : "bg-border-strong")} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className={cn("font-medium", passed ? "text-subtle" : "text-foreground")}>
                {step.label}
                <span className="ml-2 font-mono text-xs font-normal text-subtle">{passed ? "passed" : `in ${countdown(step.at)}`}</span>
              </p>
              <p className="text-xs text-subtle">
                {absoluteTime(step.at)} · {step.text}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const resolutionText = (market: Market) => {
  if (market.status === 5) return "Resolved. Positions have been closed and settled.";
  if (market.status === 4) return "Locked: trading has stopped and remaining positions are being closed at the protected mark.";
  if (market.closeTime > 0 && market.closeTime <= Date.now() / 1000) return "The event has closed. Waiting for the source market’s final result and for Moxie to settle the market.";
  return "Open. Moxie closes any remaining positions at the protected mark just before the event closes, then marks the market resolved from the source market’s final result.";
};

export function MarketInfo({ market, cluster }: { market: Market; cluster: string }) {
  const verification = useRulesVerification(market.rules, market.rulesHash);
  const oracleTone = market.indexStale || market.oracleHealth === "Stale" ? "text-warning" : market.oracleHealth === "Healthy" ? "text-long" : "text-muted";
  return (
    <div className="grid gap-8 p-4 sm:p-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="space-y-8">
        <Section title="Resolution rules">
          {market.rules ? <RulesText text={market.rules} /> : <p className="text-sm text-muted">The rule text isn’t available from the indexer. Read it on the source market.</p>}
          <VerificationNote state={verification} />
        </Section>
        <Section title="Schedule">
          <Schedule market={market} />
        </Section>
      </div>

      <div className="space-y-8">
        <Section title="Source market">
          <dl className="space-y-2">
            <Row label="Provider">{market.providerLabel} · Solana mainnet</Row>
            <Row label="Market ID">
              <span className="font-mono text-xs" title={market.providerMarketId}>{shortAddress(market.providerMarketId, 6)}</span>
            </Row>
          </dl>
          {market.sourceUrl ? (
            <a href={market.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:text-signal">
              View on {market.providerLabel} <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </a>
          ) : null}
        </Section>

        <Section title="Prices and oracle">
          <dl className="space-y-2">
            <Row label="Source index"><span className="font-mono">{price(market.index)}</span></Row>
            <Row label="Protected mark"><span className="font-mono">{price(market.mark)}</span></Row>
            <Row label="Last oracle update">{timeAgo(market.oracleUpdatedAt)}</Row>
            <Row label="Oracle status"><span className={oracleTone}>{market.indexStale ? "Paused" : market.oracleHealth}</span></Row>
          </dl>
          {market.indexStale ? <p className="text-xs leading-5 text-subtle">The source isn’t publishing a price right now. Trading continues on Moxie’s own price.</p> : null}
        </Section>

        <Section title="Resolution">
          <p className="text-sm leading-6 text-muted">{resolutionText(market)}</p>
        </Section>

        <Section title="On-chain record">
          <dl className="space-y-2">
            <Row label="Oracle record">
              <a href={`https://explorer.solana.com/address/${market.address}?cluster=${cluster}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs hover:text-signal">
                {shortAddress(market.address, 6)} <ArrowUpRight className="size-3" aria-hidden="true" />
              </a>
            </Row>
            <Row label="Percolator asset"><span className="font-mono text-xs">#{market.assetIndex} · market {market.marketId}</span></Row>
            {market.rulesHash ? (
              <Row label="Rules fingerprint">
                <span className="font-mono text-xs" title={market.rulesHash}>{shortAddress(market.rulesHash, 6)}</span>
              </Row>
            ) : null}
          </dl>
        </Section>
      </div>
    </div>
  );
}
