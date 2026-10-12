import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, Info, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

// Building blocks for documentation pages. Kept deliberately small so every page reads the same.

export function DocHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description?: ReactNode }) {
  return (
    <header className="border-b border-border pb-8">
      <p className="inline-flex rounded-full bg-foreground px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-on-dark)]">{eyebrow}</p>
      <h1 className="font-display-condensed mt-4 text-4xl sm:text-5xl">{title}</h1>
      {description ? <p className="mt-4 text-lg text-muted">{description}</p> : null}
    </header>
  );
}

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function H2({ children, id }: { children: string; id?: string }) {
  const anchor = id ?? slug(children);
  return (
    <h2 id={anchor} className="group mt-14 scroll-mt-24 text-2xl font-semibold tracking-tight">
      {children}
      <a href={`#${anchor}`} className="ml-2 text-subtle opacity-0 transition-opacity group-hover:opacity-100" aria-label={`Link to ${children}`}>#</a>
    </h2>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-8 text-lg font-semibold">{children}</h3>;
}

export function P({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("mt-4 leading-7 text-muted", className)}>{children}</p>;
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-muted marker:text-subtle">{children}</ul>;
}

export function OL({ children }: { children: ReactNode }) {
  return <ol className="mt-4 list-decimal space-y-2 pl-5 leading-7 text-muted marker:text-subtle">{children}</ol>;
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-foreground">{children}</strong>;
}

export function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-sm bg-surface-3 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">{children}</code>;
}

export function CodeBlock({ children, title }: { children: string; title?: string }) {
  return (
    <div className="mt-5 overflow-hidden rounded-lg border border-border bg-surface">
      {title ? <div className="border-b border-border px-4 py-2 font-mono text-xs text-subtle">{title}</div> : null}
      <pre className="overflow-x-auto p-4 text-sm leading-6"><code className="font-mono text-foreground">{children.trim()}</code></pre>
    </div>
  );
}

const calloutStyles = {
  tip: { icon: Lightbulb, box: "border-signal/30 bg-signal/5", iconColor: "text-signal" },
  note: { icon: Info, box: "border-border-strong bg-surface-2", iconColor: "text-muted" },
  warning: { icon: AlertTriangle, box: "border-warning/30 bg-warning/5", iconColor: "text-warning" },
};

export function Callout({ tone = "note", title, children }: { tone?: keyof typeof calloutStyles; title?: string; children: ReactNode }) {
  const { icon: Icon, box, iconColor } = calloutStyles[tone];
  return (
    <aside className={cn("mt-6 flex gap-3 rounded-lg border p-4 text-sm", box)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", iconColor)} aria-hidden="true" />
      <div className="leading-6 text-muted">
        {title ? <p className="font-medium text-foreground">{title}</p> : null}
        <div className={title ? "mt-1" : undefined}>{children}</div>
      </div>
    </aside>
  );
}

/** Numbered step with a heading, used by the getting-started walkthrough. */
export function Step({ number, title, children, id }: { number: number; title: string; children: ReactNode; id?: string }) {
  return (
    <section id={id ?? slug(title)} className="relative mt-14 scroll-mt-24 pl-12">
      <span className="absolute left-0 top-0 grid size-8 place-items-center rounded-full bg-signal font-mono text-sm font-semibold text-signal-foreground">{number}</span>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-5 overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-subtle">
            {head.map((h) => <th key={h} scope="col" className="px-4 py-2.5 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border align-top last:border-0">
              {row.map((cell, j) => <td key={j} className={cn("px-4 py-3 leading-6", j === 0 ? "text-foreground" : "text-muted")}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function NextLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="group mt-12 flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-signal/40">
      <span>
        <span className="block text-xs text-subtle">Next</span>
        <span className="mt-1 block font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-sm text-muted">{description}</span>
      </span>
      <ArrowRight className="size-5 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-signal" aria-hidden="true" />
    </Link>
  );
}
