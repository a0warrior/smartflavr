import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['mysql2'],
  experimental: {
    inlineCss: true,
  },
  async headers() {
    return [
      {
        // Prevent browsers from caching HTML pages. Static assets under /_next/static/
        // are content-hashed and already get immutable caching from Next.js — we
        // exclude them here so we don't override that correct behavior.
        source: "/((?!_next/static|_next/image|favicon\\.ico).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store",
          },
        ],
      },
    ];
  },
};

export default nextConfig;