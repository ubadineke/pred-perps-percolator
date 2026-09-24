"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { Check, ChevronRight, LogOut, Mail, Wallet, X } from "lucide-react";
import { usePrivyWalletState } from "./wallet-providers";

function shortAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function WalletControl() {
  const [open, setOpen] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const privy = usePrivyWalletState();
  const external = useWallet();

  const externalWallets = useMemo(
    () => external.wallets.filter(({ adapter }) => !adapter.name.toLowerCase().includes("privy")),
    [external.wallets],
  );
  const externalAddress = external.publicKey?.toBase58() ?? null;
  const activeAddress = externalAddress ?? privy.address;
  const activeLabel = externalAddress ? external.wallet?.adapter.name : privy.address ? "Privy" : null;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const dialog = closeButtonRef.current?.closest("[role='dialog']");
      const focusable = dialog?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled)");
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
    document.addEventListener("keydown", handleDialogKeys);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleDialogKeys);
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

  return (
    <>
      <button
        className={`wallet-button${activeAddress ? " connected" : ""}`}
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        aria-haspopup="dialog"
      >
        <Wallet size={16} aria-hidden="true" />
        {activeAddress ? shortAddress(activeAddress) : "Connect"}
      </button>

      {open ? (
        <div className="wallet-modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className="wallet-modal" role="dialog" aria-modal="true" aria-labelledby="wallet-modal-title">
            <header>
              <div>
                <span className="wallet-modal-index">ACCOUNT / SOLANA</span>
                <h2 id="wallet-modal-title">{activeAddress ? "Wallet connected" : "Enter Moxie"}</h2>
                <p>{activeAddress ? "Your active signing account." : "Choose fast onboarding or connect an existing wallet."}</p>
              </div>
              <button ref={closeButtonRef} className="wallet-modal-close" type="button" onClick={() => setOpen(false)} aria-label="Close wallet dialog">
                <X size={17} aria-hidden="true" />
              </button>
            </header>

            {activeAddress ? (
              <div className="wallet-connected-panel">
                <span className="wallet-source"><Check size={13} aria-hidden="true" /> {activeLabel}</span>
                <code>{activeAddress}</code>
                <button className="wallet-disconnect" type="button" onClick={disconnectActive}>
                  <LogOut size={15} aria-hidden="true" /> Disconnect
                </button>
              </div>
            ) : (
              <div className="wallet-methods">
                <button
                  className="wallet-method featured"
                  type="button"
                  onClick={() => privy.login()}
                  disabled={!privy.enabled || !privy.ready}
                >
                  <span className="wallet-method-icon"><Mail size={18} aria-hidden="true" /></span>
                  <span><strong>Continue with Privy</strong><small>Email or Google · wallet created for you</small></span>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
                {!privy.enabled ? <p className="wallet-config-note">Privy needs <code>NEXT_PUBLIC_PRIVY_APP_ID</code>. Regular wallets remain available.</p> : null}

                <div className="wallet-divider"><span>OR USE A SOLANA WALLET</span></div>

                <div className="wallet-list">
                  {externalWallets.length ? externalWallets.map(({ adapter, readyState }) => {
                    const installed = readyState === WalletReadyState.Installed || readyState === WalletReadyState.Loadable;
                    return (
                      <button className="wallet-method" type="button" key={adapter.name} onClick={() => connectExternal(adapter.name)} disabled={connecting !== null}>
                        <span className="wallet-method-icon wallet-icon-image"><img src={adapter.icon} alt="" /></span>
                        <span><strong>{adapter.name}</strong><small>{connecting === adapter.name ? "Waiting for approval…" : installed ? "Detected in this browser" : "Open wallet"}</small></span>
                        <ChevronRight size={16} aria-hidden="true" />
                      </button>
                    );
                  }) : (
                    <div className="wallet-empty-state">
                      <Wallet size={18} aria-hidden="true" />
                      <span><strong>No Solana wallet detected</strong><small>Install Phantom, Solflare, or Backpack, then reload.</small></span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {error ? <p className="wallet-error" role="alert">{error}</p> : null}
            <footer>Transactions always require your explicit approval.</footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
