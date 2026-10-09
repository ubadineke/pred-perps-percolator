import { cn } from "@/lib/utils";

/** Moxie wordmark: two slanted bars (probability moving between two outcomes) + name. */
export function BrandMark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 28 24" className="h-5 w-auto text-signal" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
        <path d="M3 21 L9 3 L13 3 L7 21 Z" />
        <path d="M15 21 L21 3 L25 3 L19 21 Z" />
      </svg>
      {!compact ? <span className="text-[15px] font-semibold tracking-[0.18em] text-foreground">MOXIE</span> : <span className="sr-only">Moxie</span>}
    </span>
  );
}
