import type { Metadata } from "next";
import { Braces, DatabaseZap, Radio, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Container, PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "How it works" };

const layers = [
  { icon: Radio, title: "Provider adapters", text: "Normalize event identity, probabilities and lifecycle signals from external prediction venues." },
  { icon: DatabaseZap, title: "Authenticated oracle", text: "Validate freshness and provenance before publishing a bounded probability mark on Solana." },
  { icon: Braces, title: "Moxie execution", text: "Produce inventory-aware quotes and bind every fill to its market, policy and oracle observation." },
  { icon: ShieldCheck, title: "Percolator clearing", text: "Maintain shared collateral, positions, PnL and solvency beneath the product layer." },
];

const responsibilities = [
  { who: "External venue", what: "Defines the event and its reference probability." },
  { who: "Moxie market", what: "Sets the execution price from order flow." },
  { who: "Protected mark", what: "Values margin and guards liquidations against sudden moves." },
  { who: "Percolator", what: "Accounts for collateral, clearing and solvency." },
];

const lifecycle = [
  { stage: "Active", text: "Open for new positions in either direction." },
  { stage: "Restricted", text: "Smaller order sizes as the close approaches." },
  { stage: "Reduce only", text: "Positions can be closed, not grown." },
  { stage: "Settled", text: "Remaining positions close at the deadline and the outcome resolves." },
];

export default function TechnologyPage() {
  return (
    <AppShell>
      <Container className="pb-20">
        <PageHeader
          eyebrow="How it works"
          title="Every trade has a chain of proof."
          description="Moxie keeps event discovery, price formation and solvency separate — and shows you where each boundary sits."
        />

        <section aria-labelledby="layers-heading">
          <h2 id="layers-heading" className="sr-only">System layers</h2>
          <ol className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {layers.map((layer, index) => (
              <li key={layer.title} className="bg-background p-6">
                <div className="flex items-center justify-between">
                  <layer.icon className="size-5 text-signal" aria-hidden="true" />
                  <span className="font-mono text-xs text-subtle">0{index + 1}</span>
                </div>
                <h3 className="mt-6 font-semibold">{layer.title}</h3>
                <p className="mt-2 text-sm text-muted">{layer.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="responsibility-heading" className="mt-20 grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 id="responsibility-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">Know what moves what.</h2>
            <p className="mt-3 text-muted">Each part of the system owns one job. None of them can quietly change another’s.</p>
          </div>
          <dl className="divide-y divide-border rounded-lg border border-border">
            {responsibilities.map((row) => (
              <div key={row.who} className="grid gap-1 px-5 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
                <dt className="font-medium text-foreground">{row.who}</dt>
                <dd className="text-muted">{row.what}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="lifecycle-heading" className="mt-20">
          <h2 id="lifecycle-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">Markets that know they end.</h2>
          <p className="mt-3 max-w-2xl text-muted">Prediction markets close. Moxie tightens risk on a schedule before the deadline, so nobody is surprised at settlement.</p>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {lifecycle.map((item, index) => (
              <li key={item.stage} className="rounded-lg border border-border bg-surface p-5">
                <span className="font-mono text-xs text-subtle">Stage {index + 1}</span>
                <h3 className="mt-2 font-semibold">{item.stage}</h3>
                <p className="mt-1 text-sm text-muted">{item.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </Container>
    </AppShell>
  );
}
