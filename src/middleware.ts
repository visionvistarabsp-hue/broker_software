import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Simple in-memory rate limiter (per IP, sliding window).
 *
 * Enforced for public entry points: login, registration, password reset,
 * OTP verification, and the share referral link. API auth routes use the
 * same window. Phone-level OTP attempt counting also lives in the OTP
 * service in src/lib/auth/otp.ts (spec Â§6).
 *
 * Production note: the in-memory store is process-local. For multi-replica
 * deployments, replace with Redis-backed rate limiting and re-run this
 * middleware's clear() boundary.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 100;
const MAX_BAN_IPS = 2;

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

export function clearRateLimiter(): void {
  buckets.clear();
}

/**
 * Build a nonce-based Content Security Policy.
 *
 * The previous policy used `script-src 'self'` with no nonce, which blocks
 * Next.js/React's inline bootstrap and RSC streaming scripts. That prevented
 * hydration and left every page blank. Next.js reads the nonce from the
 * `Content-Security-Policy` request header and automatically applies it to the
 * framework scripts, page bundles and inline scripts it emits (see
 * https://nextjs.org/docs/app/guides/content-security-policy).
 */
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: http:${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self' http: https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export function middleware(request: NextRequest): Response | null {
  const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",").map((s) => s.trim()).pop() ?? "unknown";
  const now = Date.now();
  const endpoint = request.nextUrl.pathname;

  const sensitive = new Set([
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify",
    "/set-password",
  ]);
  // API auth routes (D&D webhook path) are rate limited too.
  const apiAuth = /^\/api\/auth\//;
  const isSensitive = sensitive.has(endpoint) || apiAuth.test(endpoint);
  if (isSensitive) {
    const bucket = buckets.get(ip) ?? { count: 0, windowStart: now };
    if (now - bucket.windowStart >= WINDOW_MS) {
      bucket.count = 1;
      bucket.windowStart = now;
    } else if (bucket.count >= MAX_REQUESTS) {
      const response = new NextResponse(JSON.stringify({ error: "Too many requests. Slow down." }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
      return response;
    } else {
      bucket.count += 1;
      buckets.set(ip, bucket);
    }
  }

  // Global cap on tracked buckets to keep memory bounded.
  if (buckets.size > 20000) buckets.clear();

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Apply the CSP to every document/route except immutable build assets and
  // static files. API auth routes remain rate-limited (handled above).
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif|css|js|map|txt|json|xml|woff|woff2|ttf|otf|eot)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
