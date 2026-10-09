"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Menu, X } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { WalletControl } from "./wallet-control";
import { usePrivyWalletState } from "./wallet-providers";
import { LiveDot } from "./ui/primitives";
import { cn } from "@/lib/utils";

const links = [
  { href: "/markets", label: "Markets", match: (p: string) => p === "/markets" },
  { href: "/trade", label: "Trade", match: (p: string) => p.startsWith("/trade") },
  { href: "/portfolio", label: "Portfolio", match: (p: string) => p.startsWith("/portfolio") },
  { href: "/technology", label: "Technology", match: (p: string) => p.startsWith("/technology") },
];

export function SiteHeader({ cluster, marketAuthority }: { cluster: string; marketAuthority?: string }) {
  const path = usePathname() ?? "/";
  const wallet = useWallet();
  const privy = usePrivyWalletState();
  const address = wallet.publicKey?.toBase58() || privy.address || "";
  const isAuthority = Boolean(marketAuthority && address === marketAuthority);
  const [open, setOpen] = useState(false);
  const nav = isAuthority ? [...links, { href: "/admin/markets", label: "Admin", match: (p: string) => p.startsWith("/admin") }] : links;

  useEffect(() => setOpen(false), [path]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="rounded-md" aria-label="Moxie home">
          <BrandMark />
        </Link>

        <nav aria-label="Primary" className="hidden flex-1 items-center gap-1 md:flex">
          {nav.map((link) => {
            const active = link.match(path);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "text-foreground" : "text-subtle hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-2 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted sm:inline-flex">
            <LiveDot tone="long" />
            {cluster === "devnet" ? "Devnet" : cluster}
          </span>
          <WalletControl />
          <button
            type="button"
            className="grid size-10 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open ? (
        <nav id="mobile-nav" aria-label="Primary" className="border-t border-border bg-background px-4 pb-4 pt-2 md:hidden">
          {nav.map((link) => {
            const active = link.match(path);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex h-12 items-center rounded-md px-3 text-base font-medium", active ? "bg-surface-2 text-foreground" : "text-muted")}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </header>
  );
}
