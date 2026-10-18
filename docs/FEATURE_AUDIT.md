# Feature Audit — Real Estate Referral CRM

Date: 2026-10-16
Legend: **Implemented** = working code + at least some automated test coverage;
**Partial** = code exists but has gaps (missing tests, incomplete behaviour, or inconsistencies);
**Missing** = no implementation found; **Unverified** = code present, behaviour not proven by an executed test.

This audit is based on reading source, not on the existence of a page. A route existing is
not treated as proof the feature works.

---

## 1. Feature matrix

| # | Feature | Status | Implementation (key files) | Automated tests |
|---|---------|--------|----------------------------|-----------------|
| 1 | Admin / Channel Partner / Referral Partner roles | Implemented | `prisma/schema.prisma` (`Role`), `src/lib/authz/index.ts` | `src/lib/authz/authz.test.ts` |
| 2 | Referral Partner registration (phone + OTP + password setup) | Implemented | `src/lib/services/registration.ts`, `src/lib/actions/auth.ts`, `src/app/(auth)/register|verify|set-password/page.tsx` | `src/lib/services/registration.test.ts` |
| 3 | Channel Partner registration | Implemented | same as above (role chosen at registration) | `src/lib/services/registration.test.ts` |
| 4 | Login (phone or email + password) | Implemented | `src/lib/services/auth-flow.ts`, `src/lib/auth/session.ts` | `src/lib/services/auth-flow.test.ts` |
| 5 | OTP login / password reset | Implemented | `src/lib/services/auth-flow.ts`, `src/lib/auth/otp.ts` | `src/lib/services/auth-flow.test.ts`, `auth-security.test.ts` |
| 6 | Email OTP delivery via SMTP | **Partial / Defective** | `src/lib/auth/otp-provider.ts` | (no delivery test) — see BUG-003 |
| 7 | Reference-broker referral submission via share link | Implemented | `src/lib/services/referral.ts`, `src/app/share/[brokerCode]/page.tsx`, `src/components/referral-form.tsx` | `src/lib/services/referral.test.ts` |
| 8 | Channel-partner property-linked lead creation | Implemented | `src/lib/services/leads.ts`, `src/lib/actions/crm.ts`, `src/components/forms/lead-form.tsx` | (indirect) via commissions/referral setup |
| 9 | Admin property management (CRM `Property`) | Implemented | `src/lib/services/properties.ts`, `src/app/(app)/properties/*`, `src/components/forms/property-form.tsx` | `src/lib/validation/property.ts` (validation only) |
| 10 | Unique code generation | **Partial** | `src/lib/services/codes.ts` (10-char Crockford) | `src/lib/services/codes.test.ts` — see BUG-014 (two schemes) |
| 11 | Phone normalization | Implemented | `src/lib/services/phone.ts` | `src/lib/services/phone.test.ts` |
| 12 | Duplicate detection on submission | Implemented | `src/lib/services/referral.ts`, `src/lib/services/leads.ts` (`DuplicateReview` created) | `src/lib/services/referral.test.ts` |
| 13 | Duplicate review workflow / attribution decisions | Implemented | `src/lib/services/duplicates.ts`, `src/app/(app)/duplicates/page.tsx` | `src/lib/services/duplicates.test.ts` |
| 14 | Shared phone for distinct customers (phone not unique) | Implemented | `prisma/schema.prisma` (`Customer.phoneNormalized` not unique) | `src/lib/services/customers.test.ts` |
| 15 | Concurrent submission safety (advisory lock) | **Fixed** | `src/lib/services/leads.ts`, `referral.ts` use `pg_advisory_xact_lock` | `referral.test.ts` (concurrency regression) |
| 16 | Lead status history / transitions | Implemented | `src/lib/services/leads.ts`, `LeadStatusHistory`, `isValidLeadTransition` | `src/lib/validation/crm.test.ts` |
| 17 | Follow-ups scheduling | Implemented | `src/lib/services/followups.ts`, `src/app/(app)/followups/page.tsx` | `src/lib/services/followups.test.ts` |
| 18 | Notifications | Implemented | `src/lib/services/notifications.ts`, `src/components/notifications-bell.tsx` | (partial) `followups.test.ts` |
| 19 | Cron reminder generation | **Fixed (auth)** | `src/app/api/cron/follow-ups/route.ts` | `src/app/api/cron/follow-ups/route.test.ts` |
| 20 | Property matching | Implemented | `src/lib/services/matching.ts`, `src/components/lead-match-panel.tsx` | `src/lib/services/matching.test.ts` |
| 21 | Reports / conversion rates | Implemented | `src/lib/services/reports.ts`, `src/app/(app)/dashboard/page.tsx` | `src/lib/services/reports.test.ts` |
| 22 | Commission rules / commissions / payouts | **Fixed** | `src/lib/services/commissions.ts` | `src/lib/services/commissions.test.ts` |
| 23 | Collaboration (co-broker access) | Implemented | `src/lib/services/collaboration.ts`, `src/components/collaborators-panel.tsx` | `src/lib/services/collaboration.test.ts` |
| 24 | Reputation scoring | Implemented | `src/lib/services/reputation.ts`, `src/app/(app)/reputation/page.tsx` | `collaboration.test.ts` |
| 25 | CSV import / export | Implemented | `src/lib/services/csv.ts`, `src/lib/actions/csv.ts`, `src/components/csv-import-export.tsx` | `src/lib/services/csv.test.ts` |
| 26 | Sessions (issue/rotate/revoke/expiry) | Implemented | `src/lib/auth/session.ts` | `src/lib/auth/session.test.ts` |
| 27 | Account suspension / deactivation | Implemented | `src/lib/services/brokers.ts`, `src/lib/auth/session.ts` | `brokers.test.ts`, `auth-security.test.ts` |
| 28 | Security headers / CSP | Implemented | `next.config.ts` | (none — config only) |
| 29 | Rate limiting | Implemented | `src/middleware.ts` (in-memory, per-IP) | (none directly) |
| 30 | PWA / offline | Implemented | `public/sw.js`, `public/manifest.json`, `public/offline.html`, `src/components/sw-register.tsx` | (none) |
| 31 | QR code generation (share link) | Implemented | `src/lib/qr.ts`, `scripts/qr-selfcheck.ts` | `src/lib/qr.test.ts` |
| 32 | Admin broker administration | Implemented | `src/lib/services/brokers.ts`, `src/app/(app)/admin/brokers/*` | `src/lib/services/brokers.test.ts` |

## 2. Cross-cutting gaps

- **No E2E tests.** No Playwright/Cypress suite. UI flows (forms, navigation, calendar) are
  not automatically exercised.
- **UI components are largely untested.** Server actions and React components have no
  component/integration tests; behaviour is verified at the service layer.
- **No HTTP-level authorization tests.** Because almost everything is a Server Action
  (not a REST route), "direct API enforcement" is limited to the single cron route.
- **Dead / divergent authorization helpers.** `canAccessLead`, `scopeLeadWhere`,
  `assertSameBrokerOrAdmin`, `isActive` are exported and unit-tested in
  `src/lib/authz/index.ts` but services use inline, duplicated authorization logic. This
  is a maintainability/consistency risk (BUG-015).
- **Audit logging is best-effort only.** `writeAudit` swallows all errors (BUG-010), and
  `setBrokerStatus` writes no audit entry at all (BUG-011).
- **Two different code-generation schemes** coexist (BUG-014): `codes.ts` produces random
  10-char Crockford codes (broker/lead/customer/property), while `csv.ts` generates
  prefixed human codes (`LD-…`, `PR-…`, `CU-…`). The spec specifies 10-char Crockford for
  all identifiers.

## 3. Requirements fidelity notes

- Currency/locale (INR, +91, sq.ft.) and single-tenant decisions from the design spec are
  respected in the schema and phone service.
- The design spec required a **transaction-scoped advisory lock keyed on normalized phone**
  for concurrent submissions. This was missing and has been implemented (BUG-009).
- The design spec required audit entries for sensitive operations; commission/payout,
  duplicate decisions and status changes write audit, but suspensions do not (BUG-011).

## 4. Not implemented (as far as this repository shows)

- End-to-end browser tests.
- Redis/distributed rate limiting (documented as a production follow-up in `middleware.ts`).
- SMS OTP (explicitly out of scope: email OTP only; paid SMS is not a dependency).
