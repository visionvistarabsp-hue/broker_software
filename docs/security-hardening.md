# Security Hardening (Phase 13/14)

## Policy

| Control | Implementation | Location |
|---|---|---|
| Content-Security-Policy | `default-src 'self'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'` (Tailwind injects inline styles) | Next.js `headers()` |
| Strict-Transport-Security | `max-age=31536000; includeSubDomains` | same |
| X-Frame-Options | `DENY` (clickjacking) | same |
| X-Content-Type-Options | `nosniff` | same |
| Referrer-Policy | `strict-origin-when-cross-origin` | same |
| Permissions-Policy | disable geolocation/microphone/camera | same |
| No-cache | `Cache-Control: no-cache` on all responses | same |

## Rate limiting (Phase 14)

`src/middleware.ts` — per-IP sliding window (`/login`, `/register`, password reset, OTP/verify/set-password, `/api/auth/*`, `/share/:brokerCode`). 100 requests per 60s → HTTP 429.

- **OTP/phone-level attempt tracking** lives in `src/lib/auth/otp.ts` (spec §6): single-use, expiring, attempt-capped, per phone and per IP. Middleware covers IP-level brute force; the OTP service covers the phone-level replay logic.
- The store is process-local (in-memory). For multi-replica deployments, replace with Redis-backed rate limiting and hoist `clearRateLimiter()`.

## Tokens & sessions

- Argon2id password hashes (`@node-rs/argon2`).
- Opaque session tokens hashed in DB; rotation on login/privilege change; revocation on logout/suspension.
- Server actions are guarded by `requireUser` / `requireRole` / record-scoping before any write.

## Web Vitals & telemetry

No analytics scripts are injected. The CSP `script-src 'self'` allows only first-party scripts.
