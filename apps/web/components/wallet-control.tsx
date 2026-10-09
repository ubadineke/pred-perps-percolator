"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { Check, ChevronRight, Copy, LogOut, Mail, Wallet, X } from "lucide-react";
import { usePrivyWalletState } from "./wallet-providers";
import { Alert } from "./ui/primitives";
import { buttonClasses } from "./ui/button";
import { shortAddress } from "@/lib/format";
import { cn } from "@/lib/utils";

export function WalletControl() {
  const [open, setOpen] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const privy = usePrivyWalletState();
  const external = useWallet();

  const externalWallets = useMemo(
    () => external.wallets.filter(({ adapter }) => !adapter.name.toLowerCase().includes("privy")),
    [external.wallets],
  );
  const externalAddress = external.publicKey?.toBase58() ?? null;
  const activeAddress = externalAddress ?? privy.address;
  const activeLabel = externalAddress ? external.wallet?.adapter.name : privy.address ? "Privy" : null;

  // Modal behaviour: lock scroll, focus the close button, trap Tab, close on Escape, restore focus.
  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled)");
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  async function connectExternal(name: (typeof externalWallets)[number]["adapter"]["name"]) {
    const choice = externalWallets.find(({ adapter }) => adapter.name === name);
    if (!choice) return;
    setConnecting(name);
    setError(null);
    try {
      external.select(name);
      await choice.adapter.connect();
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not connect ${name}.`);
    } finally {
      setConnecting(null);
    }
  }

  async function disconnectActive() {
    setError(null);
    try {
      if (external.connected) await external.disconnect();
      else if (privy.authenticated) await privy.logout();
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not disconnect the wallet.");
    }
  }

  async function copyAddress() {
    if (!activeAddress) return;
    await navigator.clipboard.writeText(activeAddress).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1_500);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        aria-haspopup="dialog"
        className={buttonClasses({ variant: activeAddress ? "outline" : "primary", size: "md", className: "h-9 px-3.5" })}
      >
        <Wallet className="size-4" aria-hidden="true" />
        {activeAddress ? <span className="font-mono text-sm">{shortAddress(activeAddress)}</span> : "Connect"}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-end bg-black/70 p-0 backdrop-blur-sm sm:place-items-center sm:p-4"
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-dialog-title"
            className="w-full max-w-md rounded-t-xl border border-border bg-surface shadow-2xl sm:rounded-xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border p-5">
              <div>
                <h2 id="wallet-dialog-title" className="text-lg font-semibold">{activeAddress ? "Wallet connected" : "Connect a wallet"}</h2>
                <p className="mt-1 text-sm text-muted">{activeAddress ? "This account signs your Moxie transactions." : "Use an existing Solana wallet, or sign in with email."}</p>
              </div>
              <button ref={closeButtonRef} type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground">
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {activeAddress ? (
                <>
                  <div className="rounded-md border border-border bg-surface-2 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-long"><Check className="size-3.5" aria-hidden="true" /> {activeLabel}</p>
                    <p className="mt-2 break-all font-mono text-sm text-foreground">{activeAddress}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={copyAddress} className={buttonClasses({ variant: "outline" })}>
                      {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                      {copied ? "Copied" : "Copy address"}
                    </button>
                    <button type="button" onClick={disconnectActive} className={buttonClasses({ variant: "outline" })}>
                      <LogOut className="size-4" aria-hidden="true" /> Disconnect
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {privy.enabled ? (
                    <WalletOption
                      icon={<Mail className="size-4" aria-hidden="true" />}
                      title="Continue with email"
                      subtitle="Email or Google — a wallet is created for you"
                      onClick={() => privy.login()}
                      disabled={!privy.ready}
                    />
                  ) : null}
                  <div>
                    <p className="mb-2 text-xs font-medium text-subtle">Solana wallets</p>
                    <div className="space-y-2">
                      {externalWallets.length ? (
                        externalWallets.map(({ adapter, readyState }) => {
                          const installed = readyState === WalletReadyState.Installed || readyState === WalletReadyState.Loadable;
                          return (
                            <WalletOption
                              key={adapter.name}
                              icon={<img src={adapter.icon} alt="" className="size-5 rounded" />}
                              title={adapter.name}
                              subtitle={connecting === adapter.name ? "Waiting for approval…" : installed ? "Detected in this browser" : "Open wallet"}
                              onClick={() => connectExternal(adapter.name)}
                              disabled={connecting !== null}
                            />
                          );
                        })
                      ) : (
                        <Alert title="No Solana wallet detected">Install Phantom, Solflare or Backpack, then reload this page.</Alert>
                      )}
                    </div>
                  </div>
                </>
              )}
              {error ? <Alert tone="error">{error}</Alert> : null}
            </div>
            <p className="border-t border-border px-5 py-3 text-xs text-subtle">Every transaction asks for your approval in the wallet first.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}

function WalletOption({ icon, title, subtitle, onClick, disabled }: { icon: React.ReactNode; title: string; subtitle: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn("flex w-full items-center gap-3 rounded-md border border-border bg-surface-2 p-3 text-left transition-colors hover:border-border-strong hover:bg-surface-3 disabled:opacity-50")}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-3 text-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-xs text-subtle">{subtitle}</span>
      </span>
      <ChevronRight className="size-4 text-subtle" aria-hidden="true" />
    </button>
  );
}
