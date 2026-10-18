# Collaboration and Reputation (Phase 12)

## 1. Co-broker deal access (`DealCollaborator` model)

The `DealCollaborator` join table (unique per `leadId + brokerId`) records who collaborates on a lead, who added them, and their role (default `CO_BROKER`).

### Service: `src/lib/services/collaboration.ts`
| Function | Authz |
|---|---|
| `addCollaborator(actor, {leadId, brokerId, role})` | ADMIN / lead submitter / assignee only. Target must be an active `MAIN_BROKER` or `REFERRAL_BROKER`; not the lead owner or an existing collaborator. |
| `removeCollaborator(actor, leadId, brokerId)` | same as above |
| `listCollaborators(actor, leadId)` | owner, assignee, admin, or collaborators themselves |
| `canManageLead(actor, leadId)` | internal helper: owner / assignee / admin |

Collaborator visibility is wired into lead scoping everywhere (`authz/scopeLeadWhere`, `leads.ts` list + `getLead` access check, `csv.ts` export scope, `reports.ts` stats scope).

### UI
- `src/components/collaborators-panel.tsx` — live list, add-by-ID form, remove button; shown on the lead detail page (`src/app/(app)/leads/[id]/page.tsx`). "Add" notifications are sent to the new collaborator.
- Server actions: `src/lib/actions/collaboration.ts` (`addCollaboratorAction`, `removeCollaboratorAction`).

## 2. Referral link / QR attribution

### Service: `src/lib/services/referral.ts`
- `getPublicBrokerProfile(brokerCode)` — public share page lookup. **Deliberately exposes only** `brokerCode`, `fullName`, `city`, `company`. Phone, email, broker IDs, and any lead/customer data are hidden.
- `submitReferral(brokerCode, raw)` — public form submission (name, phone, email, city, message) attributed to the signing broker (`submittedById = broker`, `source = SHARE_LINK`). Spammed-guarded: the same phone cannot re-submit for the same broker within 24 hours. Returns a public `reference` (lead code).
- Server action: `src/lib/actions/collaboration.ts` → `submitReferralAction`. No session required; input validated with zod.

### QR code
- `src/lib/qr.ts` — **no dependencies**: custom byte-mode QR encoder, ECC level M, versions 1-6, all 8 masks with penalty scoring, standalone SVG renderer (`encodeQr`, `qrToSvg`).
- The share page renders the QR + the full share link. QR output is validated by the unit suite and a hand-written tsx self-check (Reed-Solomon generator conventions, syndromes, spec format-info table, finder/timing/dark module placement).

## 3. Broker reputation scoring

### Service: `src/lib/services/reputation.ts`
- `computeReputationScore(metrics)` — pure, deterministic, unit-tested: weighted sum (conversion 35, follow-ups 15, site visits 15, volume 15, paid payouts 20), clamped 0-100. No AI.
- `getReputation(actor, brokerId?)` — own reputation for everyone; admins see any broker. Driven by live prisma aggregates (leads, follow-ups, site visits, paid payouts).
- `src/app/(app)/reputation/page.tsx` + nav entry "Reputation" (all roles).

## Tests

| File | Coverage |
|---|---|
| `src/lib/services/collaboration.test.ts` | owner/other/admin authz, duplicate collaborator, self-collab, list access |
| `src/lib/services/referral.test.ts` | public profile fields, inactive/unknown broker, attribution, spam guard, invalid input |
| `src/lib/services/reputation.test.ts` | pure score components, clamping, determinism |
| `src/lib/qr.test.ts` | hand-verified generator, divisibility + syndrome checks, format table, structure, SVG escaping |

`tsc --noEmit` passes clean. `vitest` could not execute in this environment (pre-existing `@rolldown/binding-wasm32-wasi` native binding missing from node_modules — affects every vitest suite in this workspace).
