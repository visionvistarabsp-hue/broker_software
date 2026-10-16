# Real Estate Referral CRM — Design Specification

Date: 2026-10-16
Status: Approved (design phase)

## 1. Purpose

A web-based, mobile-friendly real estate lead and referral management platform with
three roles: Admin, Main Broker, and Referral Broker / Referral Partner. It manages
broker registration, customer referrals, property listings, duplicate detection, lead
follow-ups, site visits, deal progress, referral attribution, reports, and broker
performance.

The system must be secure, professional, easy to use, inexpensive to maintain, and
must not require any paid API or premium library for its core functionality. The
operator pays only for database and server infrastructure.

## 2. Confirmed decisions

These were resolved during brainstorming and are binding for the design:

- **Deployment target:** Vercel (Next.js app on Node runtime).
- **Database:** managed PostgreSQL via Neon free tier (Prisma migrations).
- **OTP delivery:** Email OTP via SMTP in production; console-only dev provider that
  is hard-blocked in production. Paid SMS is not a dependency.
- **Tenancy:** single organization (single tenant). No `tenant_id` needed.
- **Locale:** India — default country +91, currency INR (₹), area unit sq.ft.
- **Architecture:** single Next.js App Router codebase (Approach A).

## 3. Technology stack

- Frontend: Next.js 15 (App Router) + TypeScript, `src/` layout.
- Styling: Tailwind CSS. UI: shadcn/ui + Lucide icons.
- Backend: Next.js server actions + route handlers (Node runtime).
- Database: PostgreSQL (Neon). ORM/migrations: Prisma.
- Validation: Zod. Forms: React Hook Form.
- Charts: Recharts. Calendar: `react-big-calendar` (MIT) with a custom month-grid fallback.
- CSV: `papaparse` (MIT).
- Phone: `libphonenumber-js` (MIT), default region IN.
- Password hashing: Argon2id via `@node-rs/argon2` (prebuilt linux-x64-gnu binaries).
- Dates: date-fns. Email: nodemailer (SMTP).
- Testing: Vitest (unit/integration), Playwright (e2e).
- PWA: standards manifest + service worker (static caching only).

All licenses must be verified at install time and recorded in
`docs/FREE_AND_OPEN_SOURCE.md`.

## 4. System architecture

Single Next.js App Router application deployed on Vercel (Node runtime — required for
Argon2id and Prisma). Internal layering:

- `src/app/(auth)` — login, register, OTP, password-reset pages.
- `src/app/(app)/...` — role-guarded dashboards (admin, main broker, referral broker).
- `src/app/api/...` — route handlers: CSV export/import, file upload, cron, health.
- `src/lib/db` — Prisma client singleton.
- `src/lib/auth` — session create/validate/rotate, Argon2id, OTP challenge service.
- `src/lib/authz` — central RBAC + record-level access guards used by every
  action/handler.
- `src/lib/services` — domain services: codes, duplicate detection, property matching,
  status transitions, notifications, audit, reports.
- `src/lib/validation` — Zod schemas shared between forms and server.

Cross-cutting rules:

- Every server mutation passes through `authorize()` + Zod parse + transaction.
- Errors are normalized; stack traces/DB errors/credentials never sent to client.
- Sensitive operations write an audit log entry.
- A request correlation ID is attached to logs and audit entries.

Supporting infrastructure (all free/self-hostable):

- PostgreSQL — Neon free tier.
- File storage — S3-compatible adapter (Cloudflare R2 free tier or self-hosted MinIO);
  local-disk driver in development. No paid image API.
- OTP — nodemailer/SMTP in production; console provider in dev.
- Reminders — Vercel Cron calls `/api/cron/follow-ups`.
- Notifications — DB-backed, in-app only.

## 5. Data model (Prisma / PostgreSQL)

All primary tables use `id` (cuid), `createdAt`, `updatedAt`.

### Identity and accounts

- `User` — email?, phoneNormalized, passwordHash?, role (`ADMIN | MAIN_BROKER |
  REFERRAL_BROKER`), status (`PENDING | ACTIVE | SUSPENDED | DEACTIVATED`),
  phoneVerifiedAt, emailVerifiedAt, consentAt. Unique normalized phone; unique email
  when present.
- `BrokerProfile` — 1:1 to User; `brokerCode` (unique, 10 chars), fullName, profile
  fields.
- `Session` — tokenHash, userId, expiresAt, revokedAt, ip, userAgent, rotatedFromId.
- `OtpChallenge` — userId?, phone, purpose (`REGISTER | LOGIN | RESET`), codeHash,
  expiresAt, consumedAt, attemptCount.

### Customers and leads (separate concepts)

- `Customer` — `customerCode` (unique), fullName, phoneOriginal, phoneNormalized
  (indexed, NOT globally unique), email?, address?, ownerBrokerId?, createdById,
  verification/consent fields.
- `Lead` — `leadCode` (unique), customerId, submittedById, source, propertyId?,
  budgetMin/Max, preferredLocation, requirements, notes, status (`NEW | CONTACTED |
  QUALIFIED | SITE_VISIT | NEGOTIATION | CONVERTED | LOST`), priority, assignedToId?,
  nextFollowUpAt?, convertedAt?, lostAt?, lostReason?.
- `DuplicateReview` — unique leadId, candidateCustomerId, status (`PENDING | LINKED |
  DISTINCT_APPROVED | REJECTED`), decidedById?, reason?, decidedAt?.

### Property

- `Property` — `propertyCode` (unique), title, type, listingType (`SALE | RENT |
  LEASE`), address, city, locality, price, priceMin/Max, area, areaUnit, bedrooms,
  bathrooms, furnishing, description, status (`ACTIVE | INACTIVE | SOLD | RENTED |
  ARCHIVED`), verificationStatus, ownerContact (restricted), imageKeys[].
- `PropertyDocument` / `PropertyChecklist` — per-property checklist items with status,
  notes, and optional file key.

### Activity, ops, audit

- `LeadStatusHistory` — leadId, fromStatus, toStatus, changedById, reason?, createdAt
  (append-only).
- `FollowUp` — leadId, title, description, dueAt, priority, assignedToId, status
  (`PENDING | COMPLETED | CANCELLED`), completedAt?, completionNotes?,
  rescheduleHistory (json).
- `SiteVisit` — leadId, propertyId, scheduledAt, status, notes.
- `Notification` — userId, type, title, body, leadId?, readAt?, dedupeKey.
- `AuditLog` — actorId, action, targetType, targetId, summary (safe), requestId, ip,
  createdAt (append-only, no UI delete).
- `ApplicationSetting` — key/value (lead status options, property categories, policies).

### Integrity and concurrency

- Unique indexes on all four code columns; generation retries on collision
  (max ~5 attempts; safe error on exhaustion).
- Index on `Customer.phoneNormalized`.
- Duplicate-detection submission runs in a transaction guarded by a Postgres advisory
  lock keyed on the normalized phone, so concurrent submissions with the same phone
  serialize: the second sees the first and is flagged for review instead of racing.
- Customer and Lead creation for a clean submission happen in a single transaction.

## 6. Authentication and account security

- Registration (broker/referral) → OTP to phone → verify → set password (Argon2id) →
  account `PENDING` until Admin approves.
- Login: email-or-phone + password, or OTP login.
- Session: on success create `Session` row; set HttpOnly, Secure, SameSite=Lax cookie
  containing an opaque random token; DB stores only its hash. Session ID rotates on
  login and privilege change. Logout and suspension revoke sessions.
- Forgot/reset password via OTP (purpose `RESET`).
- Rate limits per phone and per IP on login and OTP endpoints.
- OTP: single-use, expiring, attempt-capped; replay rejected.
- Production cookies Secure + HttpOnly; secrets only via environment variables.
- No hardcoded OTPs, passwords, or secrets anywhere.

## 7. Authorization (RBAC)

Enforced server-side on every page, action, and route handler. `src/lib/authz` exposes
`requireUser()`, `requireRole(...)`, and record guards. Every query is scoped to the
caller.

- Admin: full access — brokers, customers, leads, properties, duplicate reviews,
  follow-ups, reports, settings, audit; approve/suspend/reactivate/deactivate.
- Main Broker: own leads + leads explicitly assigned; own customers; submit leads;
  select active properties; notes; follow-ups; site visits; own reports; own exports;
  profile/password. No access to other brokers' private customer records.
- Referral Broker: own referrals and statuses only; submit name + phone (+ optional
  details); own referral performance; in-app notifications. Cannot see other brokers'
  leads, private contact data, internal notes, admin-only duplicate evidence, or
  commission information.

Hiding UI controls is not security. Tests will attempt direct URL access and record-ID
swapping across accounts.

## 8. Core business logic

- **Identification codes** — `crypto.randomBytes` → Crockford base32 unambiguous
  alphabet, 10 characters. DB unique constraints are mandatory; generation retries a
  limited number of times. Codes are not secrets and contain no PII.
- **Phone normalization** — `libphonenumber-js`, default region IN, target E.164. Store
  original and normalized plus verification/creation/update timestamps.
- **Duplicate detection** — on submit: normalize → search `Customer` by normalized
  phone inside a transaction with advisory lock. No match → create Customer + Lead
  transactionally. Match → flag for duplicate review: create the Lead plus a
  `DuplicateReview(PENDING)`, preserve the new broker identity, submission time, notes,
  and referral context; never silently overwrite the existing customer; never auto-award
  attribution. Notify Admin.
- **Duplicate review** — Admin can LINK to an existing customer, accept as DISTINCT
  (`DISTINCT_APPROVED`, e.g. shared family phone), or REJECT. Each decision records
  reason, decider, timestamp, and preserves full history. A phone match is a duplicate
  signal, not conclusive proof. The schema permits an admin-approved distinct customer
  sharing a normalized phone with another customer.
- **Lead status transitions** — configurable allowed-transition policy; invalid or
  unauthorized transitions are rejected. Each change appends `LeadStatusHistory`
  (old/new, actor, time, optional reason), fires the appropriate notification, and
  updates dashboard metrics. Status history is never overwritten.
- **Property matching** — deterministic, rule-based scoring over budget, location,
  type, listing type, area, bedrooms, and availability. Hard constraints (unavailable
  property, over strict budget) disqualify a candidate. Output includes match reasons,
  mismatches, current price/availability, last-updated time. No AI API.
- **Notifications** — DB-backed per-user rows with unread counts, mark-as-read,
  mark-all-as-read, history, and a `dedupeKey` to prevent spam.
- **Audit** — append-only for suspensions/reactivations, permission changes, duplicate
  decisions, property changes, sensitive access, exports, and deletion/archival.
  Passwords, OTP values, session tokens, full identity numbers, and unnecessary
  sensitive data are never logged. Not editable/deletable via normal UI.

## 9. Productivity features

- **Follow-ups / calendar / reminders** — `FollowUp` CRUD with pending/completed/
  cancelled, overdue indicators, completion notes, reschedule history. Calendar via
  `react-big-calendar` (MIT; verify at install) or a custom month grid. Reminders are
  generated server-side by `/api/cron/follow-ups` (Vercel Cron) creating Notification
  rows for due and overdue follow-ups. Browser push is optional and degrades
  gracefully; it is never required for core function.
- **Activity timeline** — lead detail aggregates creation, referral submission, status
  changes, follow-up scheduling/completion, site visits, notes, duplicate decisions,
  property associations, and authorized assignment changes.
- **Reports** — PostgreSQL aggregation feeding Recharts. Admin dashboard: brokers by
  role/status, customers, leads by status/source, duplicate queue, overdue follow-ups,
  site visits, converted/lost, conversion rate, inventory by availability, broker
  performance. Broker dashboard: own leads by status, upcoming/overdue follow-ups,
  site visits, converted/lost, conversion rate, recent activity. Conversion rate is
  defined explicitly as converted ÷ leads created in the period. Date filters and
  pagination. Never expose another broker's private data through charts/exports.

## 10. Data exchange and documents

- **CSV** — `papaparse` import (property bulk) with preview, column mapping, required
  field validation, invalid-row report, duplicate warnings, import summary, batched
  transaction. Export for authorized reports with permission-scoped columns. Exports
  sanitize formula-injection vectors (leading `= + - @` neutralized). Import never
  executes content.
- **Property documents** — checklist tracking only; UI explicitly states it does not
  provide legal or title verification. Restricted to authorized users. File type/size
  validation. S3 or local storage driver.
- **PWA** — manifest, icons, mobile navigation, responsive tables/cards, fast loading.
  Service worker caches static assets only; private/auth responses are never cached.
  No offline-CRUD claims.

## 11. UI/UX

shadcn/ui + Lucide. Clean sidebar navigation, consistent typography/spacing,
responsive layout, accessible labeled forms, keyboard-friendly controls, searchable
tables with filters/sort/pagination, status badges, destructive-action confirmations,
loading skeletons, empty states with next actions, error states, success feedback,
validation messages, dashboard cards/charts. Light/dark via CSS variables only if it
does not compromise core features. All dashboard numbers come from real database
queries; no fake statistics. Realistic seed data is development/test only.

## 12. Security and privacy

Server-side RBAC and record-level checks; input validation and output escaping; SQL
injection protection via Prisma; CSRF protection for cookie-auth mutations; rate
limiting; secure cookie/session config; Argon2id password storage; security headers and
CSP; safe error handling; env-based secrets; file upload restrictions; audit logging;
data retention/deletion policy; privacy notice and terms pages; consent capture; secure
database backups and documented restore test. Phone numbers, emails, addresses,
owner information, and notes are treated as private. No Aadhaar collection,
authentication, or storage in v1. Never commit `.env` or real personal data.

## 13. Testing strategy

- **Unit (Vitest):** phone normalization, code gen + collision retry, Zod validation,
  property matching, lead status transitions, conversion-rate math, duplicate
  classification.
- **Integration (Vitest + test Postgres):** registration/OTP lifecycle, password
  login/logout, RBAC (ID-swap denial), lead creation, duplicate review + attribution,
  property CRUD, follow-up lifecycle, notification authorization, CSV validation, audit
  creation.
- **E2E (Playwright):** referral registration + submission, main-broker lead with
  property, admin property CRUD, duplicate review, follow-up scheduling, reports,
  unauthorized-access attempts, mobile layout/workflows.

Critical cases: (1) Broker A cannot reach Broker B's lead by ID/URL; (2) duplicate
phone triggers review; (3) admin approves a distinct customer sharing a phone;
(4) concurrent submissions do not create inconsistent records; (5) OTP cannot be
reused; (6) expired OTP rejected; (7) suspended users' sessions are invalidated;
(8) archived properties remain in historical records; (9) attribution decisions
preserve history; (10) exports do not leak unauthorized data.

Test database: Docker PostgreSQL locally; Neon test branch acceptable in CI. Tests are
reported passing only when actually executed.

## 14. Implementation phases

1. Repo inspection + plan (complete: empty greenfield repository).
2. Foundation — TS, Tailwind, shadcn, Prisma schema + migration, env/config,
   error/validation scaffolding, Docker Postgres.
3. Auth & RBAC — registration, OTP, sessions, password, guards + authz tests.
4. Core CRM — brokers, customers, leads, properties, codes, duplicate detection +
   review, status history.
5. Productivity — follow-ups, calendar, reminders/cron, notifications, matching,
   timeline, reports.
6. Data exchange & docs — CSV import/export, property document checklist, PWA.
7. Security & testing — full test run, permission/duplicate checks, lint, typecheck,
   production build.
8. Documentation — `README.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`,
   `docs/DATABASE_SCHEMA.md`, `docs/API.md`, `docs/SECURITY.md`,
   `docs/FREE_AND_OPEN_SOURCE.md`, `docs/DEPLOYMENT.md`,
   `docs/BACKUP_AND_RESTORE.md`, `docs/TESTING.md`, `.env.example`.

## 15. Known limitations / explicit non-claims

- No Aadhaar collection, verification, or storage in v1.
- Property document checklist is not legal or title certification (stated in UI).
- Reminder timeliness is bounded by the Vercel Cron schedule (Hobby = daily);
  documented with how to change it.
- File serving depends on the configured S3/local storage driver.
- Email/SMS delivery depends on configured SMTP/gateway; missing config produces a
  clear error, never a false success.
- No offline CRUD; the service worker caches static assets only.

## 16. Definition of done

Core features use real PostgreSQL; all roles have enforced server-side permissions;
registration/authentication works with the configured provider; unique codes are
DB-constrained; duplicate detection and admin review work end-to-end; status history
and timelines persist; property matching uses real data; follow-ups and notifications
work as documented; reports use real queries; CSV respects permissions; core workflows
have automated tests; lint, typecheck, and production build pass; setup/deployment
docs are usable; no required feature is falsely represented as complete; no paid API is
required for core CRM functionality.
