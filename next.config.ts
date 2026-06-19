import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['mysql2'],
  experimental: {
    inlineCss: true,
  },
};

export default nextConfig;