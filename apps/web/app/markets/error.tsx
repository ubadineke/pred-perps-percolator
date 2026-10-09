"use client";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Container, EmptyState } from "@/components/ui/primitives";

export default function MarketsError({ reset }: { reset: () => void }) {
  return (
    <AppShell>
      <Container className="py-16">
        <div className="rounded-lg border border-border">
          <EmptyState title="Markets couldn’t load" description="The market data service didn’t respond." action={<Button variant="outline" onClick={reset}>Try again</Button>} />
        </div>
      </Container>
    </AppShell>
  );
}
