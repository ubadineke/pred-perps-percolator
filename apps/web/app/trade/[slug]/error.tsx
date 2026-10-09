"use client";

import { AppShell } from "@/components/app-shell";
import { Button, LinkButton } from "@/components/ui/button";
import { Container, EmptyState } from "@/components/ui/primitives";

export default function TradeError({ reset }: { reset: () => void }) {
  return (
    <AppShell>
      <Container className="py-16">
        <div className="rounded-lg border border-border">
          <EmptyState
            title="This market couldn’t load"
            description="The market data service didn’t respond."
            action={
              <div className="flex gap-2">
                <Button variant="outline" onClick={reset}>Try again</Button>
                <LinkButton variant="ghost" href="/markets">All markets</LinkButton>
              </div>
            }
          />
        </div>
      </Container>
    </AppShell>
  );
}
