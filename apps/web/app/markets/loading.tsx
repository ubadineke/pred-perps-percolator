import { AppShell } from "@/components/app-shell";
import { Container, PageHeader, Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <AppShell>
      <Container className="pb-16" aria-busy="true">
        <PageHeader eyebrow="Markets" title="Trade the probability" description="Loading markets…" />
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </Container>
    </AppShell>
  );
}
