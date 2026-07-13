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
      {
        // Baseline security headers on every response.
        source: "/(.*)",
        headers: [
          // Stops the site from being embedded in an <iframe> elsewhere — the
          // standard defense against clickjacking (tricking a user into
          // clicking a real button on your site via an invisible overlay).
          { key: "X-Frame-Options", value: "DENY" },
          // Stops browsers from guessing ("sniffing") a file's content type
          // from its content instead of trusting the Content-Type header —
          // closes a class of XSS bugs where an uploaded file gets executed
          // as script because the browser decided it "looked like" JS/HTML.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Don't leak the full referring URL (which can contain recipe IDs,
          // share tokens, etc.) to third-party sites/images you link out to.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Tell browsers to only ever connect over HTTPS for the next year,
          // including subdomains — protects against SSL-stripping attacks.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // Disable browser features this app never uses, so a compromised
          // dependency can't quietly turn on the camera/mic/location.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;