import type { ComponentProps, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/** Page-width wrapper: one max width and one gutter for every page. */
export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)} {...props} />;
}

/** Flat bordered surface used for every card-like region. */
export function Panel({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("rounded-lg border border-border bg-surface", className)} {...props} />;
}

export function PanelHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-border px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-subtle">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

type BadgeTone = "neutral" | "signal" | "long" | "short" | "warning";
const badgeTones: Record<BadgeTone, string> = {
  neutral: "border-border-strong text-muted",
  signal: "border-signal/40 text-signal",
  long: "border-long/40 text-long",
  short: "border-short/40 text-short",
  warning: "border-warning/40 text-warning",
};

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return <span className={cn("inline-flex h-5 items-center gap-1 rounded-sm border px-1.5 text-xs font-medium leading-none", badgeTones[tone], className)} {...props} />;
}

/** Small live indicator dot. */
export function LiveDot({ tone = "signal", className }: { tone?: "signal" | "long" | "warning" | "subtle"; className?: string }) {
  const color = { signal: "bg-signal", long: "bg-long", warning: "bg-warning", subtle: "bg-subtle" }[tone];
  return <span aria-hidden="true" className={cn("inline-block size-1.5 rounded-full", color, tone !== "subtle" && "animate-pulse-dot", className)} />;
}

/** Label + value pair. Values are numeric, so they render in mono. */
export function Stat({ label, value, hint, tone, className, size = "md" }: { label: ReactNode; value: ReactNode; hint?: ReactNode; tone?: "long" | "short" | "warning"; className?: string; size?: "sm" | "md" | "lg" }) {
  const valueSize = { sm: "text-sm", md: "text-lg", lg: "text-3xl" }[size];
  const toneClass = tone ? { long: "text-long", short: "text-short", warning: "text-warning" }[tone] : "text-foreground";
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className={cn("mt-1 font-mono font-medium tracking-tight", valueSize, toneClass)}>{value}</dd>
      {hint ? <p className="mt-1 text-xs text-subtle">{hint}</p> : null}
    </div>
  );
}

/** One row in a key/value summary list. */
export function SummaryRow({ label, value, tone }: { label: ReactNode; value: ReactNode; tone?: "long" | "short" | "warning" | "muted" }) {
  const toneClass = tone ? { long: "text-long", short: "text-short", warning: "text-warning", muted: "text-muted" }[tone] : "text-foreground";
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className={cn("font-mono tabular-nums", toneClass)}>{value}</dd>
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)}>
      {icon ? <div className="grid size-10 place-items-center rounded-full border border-border text-subtle [&_svg]:size-5">{icon}</div> : null}
      <div className="max-w-sm">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

type AlertTone = "info" | "success" | "error" | "warning";
const alertTones: Record<AlertTone, { box: string; Icon: typeof Info }> = {
  info: { box: "border-border-strong bg-surface-2 text-muted", Icon: Info },
  success: { box: "border-long/30 bg-long/5 text-long", Icon: CheckCircle2 },
  error: { box: "border-short/30 bg-short/5 text-short", Icon: AlertTriangle },
  warning: { box: "border-warning/30 bg-warning/5 text-warning", Icon: AlertTriangle },
};

export function Alert({ tone = "info", title, children, className }: { tone?: AlertTone; title?: ReactNode; children?: ReactNode; className?: string }) {
  const { box, Icon } = alertTones[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-2.5 rounded-md border px-3 py-2.5 text-sm", box, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={cn("break-words", title ? "mt-0.5 text-muted" : "")}>{children}</div> : null}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-md bg-surface-3", className)} />;
}

/** Page title block used at the top of every content page. */
export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-6 py-10 sm:py-14 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? <p className="text-xs font-medium uppercase tracking-[0.14em] text-signal">{eyebrow}</p> : null}
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">{title}</h1>
        {description ? <p className="mt-4 text-base text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}

/** Two-letter avatar for a market, derived from its question. */
export function MarketAvatar({ initials, size = "md", className }: { initials: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const sizeClass = { sm: "size-7 text-xs", md: "size-9 text-xs", lg: "size-11 text-sm" }[size];
  return (
    <span aria-hidden="true" className={cn("grid shrink-0 place-items-center rounded-md border border-border-strong bg-surface-2 font-semibold tracking-tight text-signal", sizeClass, className)}>
      {initials}
    </span>
  );
}

/** Segmented control for 2–5 mutually exclusive options. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: ReactNode; tone?: "long" | "short" }[];
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-md border border-border bg-surface p-0.5", className)}>
      {options.map((option) => {
        const active = option.value === value;
        const activeTone = option.tone === "long" ? "bg-long/15 text-long" : option.tone === "short" ? "bg-short/15 text-short" : "bg-surface-3 text-foreground";
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 rounded-[5px] font-medium transition-colors duration-150",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3 text-sm",
              active ? activeTone : "text-subtle hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
