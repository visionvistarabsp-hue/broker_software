# PWA and Offline Safety (Phase 15)

## Manifest

`public/manifest.json` — installed app metadata (`short_name: BrokerCRM`, `display: standalone`, theme/background colors, icon when added to the home screen).

## Service worker `/sw.js`

- Install: precache static assets (`/`, `/_next/*`, `/icons/*`, `/manifest.json`).
- Navigation requests: **network-first**, fallback to `/offline.html` when offline.
- Static assets: **cache-first** with background repopulation.
- Activated immediately; caches keyed under `broker-crm-v1` (evict old caches on activate).

## Registration

`src/components/sw-register.tsx` + `src/app/layout.tsx` register the SW in production only. It is a **progressive enhancement**: pages work without it.

## Offline-safe behavior

- All private views are server-rendered pages (no client-only secrets).
- The only client-side data are the public broker profile shown on `/share/:brokerCode` and the referral form.
- QR codes render entirely client-side from the public share URL (no external image resources) — no network call during rendering.
- The `/share/:brokerCode` route does **not** require a session and exposes no PII beyond broker name/city/company.

> ⚠️ True offline **completeness** (every view) is not guaranteed after the build because the app fetches live data; the SW only caches the shell and reads. PWA audit in Phase 16 should record this scope.
