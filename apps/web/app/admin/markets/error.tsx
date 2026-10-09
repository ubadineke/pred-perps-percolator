"use client";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Container, EmptyState } from "@/components/ui/primitives";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <AppShell>
      <Container className="py-16">
        <div className="rounded-lg border border-border">
          <EmptyState title="Market admission couldn’t load" description="Restart the indexer or check the server-side Panta key." action={<Button variant="outline" onClick={reset}>Try again</Button>} />
        </div>
      </Container>
    </AppShell>
  );
}
