import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["three"],
  // Keep preview builds from invalidating a running development server's CSS
  // and chunk manifest. The project frequently verifies `next build` while the
  // local suite remains open for browser testing.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
