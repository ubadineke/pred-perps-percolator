import { SiteHeader } from "./site-header";

export function AppShell({ children }: { children: React.ReactNode }) {
  return <main className="app-shell"><SiteHeader />{children}</main>;
}
