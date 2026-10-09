import Link from "next/link";
import { SiteHeader } from "./site-header";
import { BrandMark } from "./brand-mark";
import { cn } from "@/lib/utils";

/** Header + page + footer. `bare` drops the footer (full-height terminal). */
export function AppShell({ children, bare = false, className }: { children: React.ReactNode; bare?: boolean; className?: string }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader cluster={process.env.MOXIE_CLUSTER ?? "devnet"} marketAuthority={process.env.MOXIE_MARKET_AUTHORITY} />
      <main className={cn("flex-1", className)}>{children}</main>
      {bare ? null : <SiteFooter />}
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div className="flex items-center gap-4">
          <BrandMark />
          <span className="text-xs text-subtle">Experimental · Solana devnet · Test funds only</span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          <Link className="hover:text-foreground" href="/markets">Markets</Link>
          <Link className="hover:text-foreground" href="/portfolio">Portfolio</Link>
          <Link className="hover:text-foreground" href="/technology">How it works</Link>
        </nav>
      </div>
    </footer>
  );
}
