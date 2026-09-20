"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Wallet } from "lucide-react";
import { BrandMark } from "./brand-mark";

const links = [
  ["/markets", "Markets"],
  ["/trade/sol-above-250-friday", "Trade"],
  ["/portfolio", "Portfolio"],
  ["/technology", "Technology"],
];

export function SiteHeader({ floating = false }: { floating?: boolean }) {
  const path = usePathname();
  return (
    <header className={floating ? "site-header floating" : "site-header"}>
      <Link href="/" className="logo-link" aria-label="Moxie home">
        <BrandMark />
      </Link>
      <nav aria-label="Primary navigation">
        {links.map(([href, label]) => (
          <Link key={href} href={href} className={path.startsWith(href.split("/").slice(0, 2).join("/")) ? "active" : ""}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="header-actions">
        <span className="network-health"><Activity size={14} aria-hidden="true" /> Devnet</span>
        <button className="wallet-button" type="button"><Wallet size={16} aria-hidden="true" /> Connect</button>
      </div>
    </header>
  );
}
