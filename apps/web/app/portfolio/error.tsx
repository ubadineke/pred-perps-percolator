"use client";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Container, EmptyState } from "@/components/ui/primitives";

export default function PortfolioError({ reset }: { reset: () => void }) {
  return (
    <AppShell>
      <Container className="py-16">
        <div className="rounded-lg border border-border">
          <EmptyState title="Your portfolio couldn’t load" description="The account data service didn’t respond." action={<Button variant="outline" onClick={reset}>Try again</Button>} />
        </div>
      </Container>
    </AppShell>
  );
}
