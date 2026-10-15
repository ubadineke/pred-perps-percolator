import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // No floating dev badge: it would appear in the generated documentation screenshots.
  devIndicators: false,
  transpilePackages: ["three"],
  // Keep preview builds from invalidating a running development server's CSS
  // and chunk manifest. The project frequently verifies `next build` while the
  // local suite remains open for browser testing.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  // Allow the dev server to be opened through an ngrok tunnel.
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok-free.dev", "*.ngrok.app"],
  // Browser requests to /indexer/* are forwarded to the local indexer.
  // The Technology page was folded into the docs; keep old links working.
  async redirects() {
    return [{ source: "/technology", destination: "/docs/how-it-works", permanent: true }];
  },
  async rewrites() {
    return [{ source: "/indexer/:path*", destination: `${process.env.MOXIE_API_URL ?? "http://127.0.0.1:8787"}/:path*` }];
  },
};

export default nextConfig;
