import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { buttonClasses } from "@/components/ui/button";
import { Container, EmptyState } from "@/components/ui/primitives";
import { cardMetrics, parseShareCard, shareCardQuery, signedPct, signedUsd } from "@/lib/share-card";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const toParams = (raw: Record<string, string | string[] | undefined>) =>
  new URLSearchParams(Object.entries(raw).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));

/** Absolute origin for preview images: social crawlers need full URLs. */
async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const card = parseShareCard(toParams(await searchParams));
  if (!card) return { title: "Shared call" };
  const { pnlUsd, roiPct } = cardMetrics(card);
  const title = `${card.side === "long" ? "Long" : "Short"} ${card.market}: ${signedUsd(pnlUsd)} (${signedPct(roiPct)})`;
  const image = `${await origin()}/api/card?${shareCardQuery(card)}`;
  const description = "Trade the odds of real-world events like a perp on Moxie. Go long or short, exit any time.";
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 675 }], siteName: "Moxie" },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function SharePage({ searchParams }: Props) {
  const card = parseShareCard(toParams(await searchParams));
  return (
    <AppShell>
      <Container className="py-10 sm:py-14">
        {card ? (
          <div className="mx-auto max-w-4xl">
            {/* eslint-disable-next-line @next/next/no-img-element -- generated card, already sized */}
            <img
              src={`/api/card?${shareCardQuery(card)}`}
              alt={`${card.side === "long" ? "Long" : "Short"} ${card.market} PnL card`}
              width={1200}
              height={675}
              className="w-full rounded-2xl border border-border shadow-[0_24px_48px_-28px_rgba(11,16,32,0.35)]"
            />
            <div className="mt-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h1 className="font-display-condensed text-3xl">Got a take? Trade it.</h1>
                <p className="mt-1 text-sm text-muted">Moxie lets you trade the odds of real events like a perp. Live on Solana devnet with test funds.</p>
              </div>
              <Link href="/markets" className={buttonClasses({ variant: "primary", size: "md" })}>
                Open the markets
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border">
            <EmptyState title="This card link is incomplete" description="Ask for a fresh link, or open the markets to make your own call." action={<Link href="/markets" className={buttonClasses({ variant: "outline", size: "md" })}>Open the markets</Link>} />
          </div>
        )}
      </Container>
    </AppShell>
  );
}
