"use client";

import { Check, Copy, Download, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CARD_DESIGNS, shareCardQuery, xIntentUrl, type CardDesign, type ShareCard } from "@/lib/share-card";
import { Button, buttonClasses } from "../ui/button";
import { Segmented } from "../ui/primitives";

const HANDLE_KEY = "moxie.share.handle";
const readHandle = () => {
  try {
    return localStorage.getItem(HANDLE_KEY) ?? "";
  } catch {
    return "";
  }
};

/** Pick a card design for a position and share it on X, copy its link, or download the image. */
export function ShareDialog({ card, onClose }: { card: Omit<ShareCard, "design" | "handle">; onClose: () => void }) {
  const [design, setDesign] = useState<CardDesign>("hero");
  const [handle, setHandle] = useState("");
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setHandle(readHandle()), []);

  // Modal behaviour: lock scroll, focus the close button, close on Escape.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);

  const cleanHandle = handle.replace(/^@/, "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 15);
  const full: ShareCard = { ...card, design, handle: cleanHandle || undefined };
  const query = shareCardQuery(full);
  const shareUrl = typeof window === "undefined" ? `/share?${query}` : `${window.location.origin}/share?${query}`;

  const rememberHandle = () => {
    try {
      localStorage.setItem(HANDLE_KEY, cleanHandle);
    } catch {}
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-[rgba(11,16,32,0.45)] p-0 backdrop-blur-sm sm:place-items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="share-dialog-title" className="w-full max-w-2xl rounded-t-xl border border-border bg-surface shadow-2xl sm:rounded-xl">
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <h2 id="share-dialog-title" className="text-lg font-semibold">Share your call</h2>
            <p className="mt-1 text-sm text-muted">{card.status === "closed" ? "Your closed position, after fees." : "Your open position, marked at the current price."}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* eslint-disable-next-line @next/next/no-img-element -- generated preview image */}
          <img key={query} src={`/api/card?${query}`} alt="PnL card preview" width={1200} height={675} className="aspect-[16/9] w-full rounded-lg border border-border bg-surface-2" />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Segmented label="Card design" value={design} onChange={setDesign} options={CARD_DESIGNS} size="sm" />
            <label className="flex items-center gap-2 text-sm text-muted">
              <span className="shrink-0">X handle</span>
              <span className="flex h-9 items-center rounded-md border border-border bg-surface px-2.5 focus-within:border-signal">
                <span className="text-subtle">@</span>
                <input value={handle} onChange={(event) => setHandle(event.target.value)} onBlur={rememberHandle} placeholder="optional" maxLength={16} className="w-32 bg-transparent px-1 text-foreground outline-none placeholder:text-subtle" />
              </span>
            </label>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href={xIntentUrl(full, shareUrl)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={rememberHandle}
              className={buttonClasses({ variant: "primary", size: "md", className: "flex-1 justify-center" })}
            >
              Post to X
            </a>
            <Button
              variant="outline"
              className="flex-1 justify-center"
              onClick={async () => {
                await navigator.clipboard.writeText(shareUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1_800);
              }}
            >
              {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              {copied ? "Link copied" : "Copy link"}
            </Button>
            <a href={`/api/card?${query}`} download="moxie-call.png" className={buttonClasses({ variant: "outline", size: "md", className: "flex-1 justify-center" })}>
              <Download className="size-4" aria-hidden="true" />
              Download
            </a>
          </div>
          <p className="text-xs text-subtle">On X the link shows as this card. Devnet, test funds.</p>
        </div>
      </div>
    </div>
  );
}
