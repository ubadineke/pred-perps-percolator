import { AppShell } from "@/components/app-shell";
import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <AppShell bare>
      <div aria-busy="true" className="grid gap-4 p-4 lg:h-[calc(100dvh-4rem)] lg:grid-cols-[17rem_minmax(0,1fr)_22rem]">
        <Skeleton className="hidden h-full lg:block" />
        <div className="space-y-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-80 lg:h-[calc(100%-7rem)]" />
        </div>
        <Skeleton className="h-96 lg:h-full" />
      </div>
    </AppShell>
  );
}
