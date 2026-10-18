import type { NextConfig } from "next";

const config: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Content-Security-Policy is set per-request in src/middleware.ts so
          // that a nonce can be applied to Next.js/React inline scripts.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
        ],
      },
      {
        // Keep HTML/dynamic responses uncached at the edge, but leave
        // _next/static (immutable build assets) to Vercel's default CDN caching.
        source: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif|css|js|map|txt|xml|woff|woff2|ttf|otf|eot)$).*)",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};

export default config;