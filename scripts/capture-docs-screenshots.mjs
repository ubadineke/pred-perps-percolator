// Regenerates the documentation screenshots in apps/web/public/docs from the running app.
//
//   1. Start the indexer (pnpm indexer:start) and the web app in development (port 3001).
//   2. node scripts/capture-docs-screenshots.mjs [baseUrl]
//
// Account-dependent states (create, fund, trading, portfolio) are rendered by the dev-only
// /capture route with sample data; the rest are the real pages.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const base = process.argv[2] ?? "http://127.0.0.1:3001";
const api = process.env.MOXIE_API_URL ?? "http://127.0.0.1:8787";
const chrome = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const out = join(dirname(fileURLToPath(import.meta.url)), "../apps/web/public/docs");
mkdirSync(out, { recursive: true });

const markets = await (await fetch(`${api}/v1/markets`)).json();
const market = markets.find((m) => m.status === 1 || m.status === 2) ?? markets[0];
if (!market) throw new Error("No indexed markets — start the indexer first.");

const shots = [
  { name: "markets", path: "/markets", size: "1440,900" },
  { name: "trade-connect", path: `/trade/${market.address}`, size: "1440,900" },
  { name: "ticket-create", path: "/capture/ticket-create", size: "500,470" },
  { name: "ticket-fund", path: "/capture/ticket-fund", size: "500,510" },
  { name: "terminal-trading", path: "/capture/terminal-trading", size: "1440,900" },
  { name: "portfolio", path: "/capture/portfolio", size: "1440,1000" },
];

for (const shot of shots) {
  // Warm the route so the dev server has compiled it before the timed capture.
  await fetch(`${base}${shot.path}`).catch(() => undefined);
  const file = join(out, `${shot.name}.png`);
  execFileSync(chrome, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--virtual-time-budget=30000",
    `--window-size=${shot.size}`, `--screenshot=${file}`, `${base}${shot.path}`,
  ], { stdio: "ignore" });
  console.log(`captured ${shot.name}.png`);
}
