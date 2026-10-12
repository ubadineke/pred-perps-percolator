import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { DocNav, DocNavMobile } from "@/components/docs/doc-nav";
import { Container } from "@/components/ui/primitives";

export const metadata: Metadata = { title: { default: "Docs", template: "%s · Moxie docs" } };

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <Container className="pb-20">
        <DocNavMobile />
        <div className="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
          <aside className="hidden lg:block">
            <div className="sticky top-24 pt-10">
              <DocNav />
            </div>
          </aside>
          <article className="min-w-0 max-w-3xl pt-10">{children}</article>
        </div>
      </Container>
    </AppShell>
  );
}
