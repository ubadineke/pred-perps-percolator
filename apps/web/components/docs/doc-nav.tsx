"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type DocPage = { href: string; label: string };

export const DOC_SECTIONS: { title: string; pages: DocPage[] }[] = [
  {
    title: "Using Moxie",
    pages: [
      { href: "/docs", label: "Overview" },
      { href: "/docs/getting-started", label: "Getting started" },
      { href: "/docs/trading", label: "Trading guide" },
      { href: "/docs/troubleshooting", label: "Troubleshooting" },
    ],
  },
  {
    title: "Concepts",
    pages: [{ href: "/docs/how-it-works", label: "How it works" }],
  },
  {
    title: "Developers",
    pages: [
      { href: "/docs/sdk", label: "TypeScript SDK" },
      { href: "/docs/api", label: "Indexer API" },
    ],
  },
];

export function DocNav() {
  const path = usePathname();
  return (
    <nav aria-label="Documentation" className="space-y-6">
      {DOC_SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="px-3 text-xs font-medium text-subtle">{section.title}</p>
          <ul className="mt-2 space-y-0.5">
            {section.pages.map((page) => {
              const active = path === page.href;
              return (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-3 py-1.5 text-sm transition-colors",
                      active ? "bg-surface-2 font-medium text-foreground" : "text-muted hover:bg-surface hover:text-foreground",
                    )}
                  >
                    {page.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Compact section switcher for small screens (the sidebar is desktop-only). */
export function DocNavMobile() {
  const path = usePathname();
  const pages = DOC_SECTIONS.flatMap((section) => section.pages);
  return (
    <nav aria-label="Documentation" className="-mx-4 overflow-x-auto border-b border-border px-4 lg:hidden">
      <ul className="flex gap-1 py-2">
        {pages.map((page) => (
          <li key={page.href}>
            <Link
              href={page.href}
              aria-current={path === page.href ? "page" : undefined}
              className={cn("block whitespace-nowrap rounded-md px-3 py-1.5 text-sm", path === page.href ? "bg-surface-2 text-foreground" : "text-muted")}
            >
              {page.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
