import { AppShell } from "@/components/app-shell";
import { Container, PageHeader, Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <AppShell>
      <Container className="pb-16" aria-busy="true">
        <PageHeader eyebrow="Portfolio" title="Your account" />
        <Skeleton className="h-36 w-full" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </Container>
    </AppShell>
  );
}
