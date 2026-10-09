import { AppShell } from "@/components/app-shell";
import { LinkButton } from "@/components/ui/button";
import { Container, EmptyState } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <AppShell>
      <Container className="py-16">
        <div className="rounded-lg border border-border">
          <EmptyState title="Page not found" description="This market or page doesn’t exist, or is no longer listed." action={<LinkButton variant="outline" href="/markets">Browse markets</LinkButton>} />
        </div>
      </Container>
    </AppShell>
  );
}
