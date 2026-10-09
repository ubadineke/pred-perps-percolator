import { AppShell } from "@/components/app-shell";
import { Container, PageHeader, Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <AppShell>
      <Container className="pb-16" aria-busy="true">
        <PageHeader eyebrow="Admin · Market authority" title="Market admission" />
        <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </Container>
    </AppShell>
  );
}
