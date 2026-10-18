# Commission Ledger

Phase 11 — commission ledger using the existing `Commission`, `Payout`, `PayoutHistory`, `CommissionRule`, and `DealCollaborator` Prisma models.

## Models

- **Commission** — one per lead (unique `leadId`). Stores `dealAmount`, `ruleId` (optional), `percentBasisPoints`, and `computedAmount`. Created via `createCommission`.
- **Payout** — splits a commission among collaborating brokers. Each payout has `shareBasisPoints` and `amount`, a `status` (`PENDING`/`APPROVED`/`PAID`/`CANCELLED`), and optional `reason`/`decidedById`/`decidedAt`. Total `shareBasisPoints` across all payouts on a commission must not exceed 10000 (100%).
- **PayoutHistory** — append-only log of every status transition. Created automatically on payout creation and every status change.
- **CommissionRule** — reusable rate card (`percentBasisPoints`, optional `appliesTo`/`minAmount`/`maxAmount`). Created by admin only.

## Authz (RBAC)

| Operation | ADMIN | MAIN_BROKER | REFERRAL_BROKER |
|---|---|---|---|
| List/create commission rules | yes | list only | no |
| List/view/create commissions | yes | leads they submitted, are assigned to, or collaborate on | no |
| List/view payouts | yes | commissions they can access, or where they are the payee | own payouts only (`payeeBrokerId`) |
| Create payouts | yes | commissions they can access | no |
| Approve payout | yes | commissions they can access | no |
| Pay / cancel payout | yes | no | no |

Referral partners are explicitly denied access to commission information per spec §7.

## Helpers

- `computeCommissionAmount(dealAmount, percentBasisPoints)` — `Math.round(dealAmount * bps / 10000)`.
- `computePayoutAmount(commissionAmount, shareBasisPoints)` — same formula for payout splits.

## Guarantees

- One commission per lead (DB unique constraint + 409 on duplicate create).
- Payout `shareBasisPoints` total is capped at 10000 per commission; checked inside `createPayout`.
- Payout status changes are wrapped in a Prisma transaction; `PayoutHistory` is written in the same transaction.
- All mutating and listing operations write an `AuditLog` entry via `writeAudit`.
- Referral partners cannot list, view, or create commissions (throws `AuthError(403)`); they only see payouts where they are the payee.

## Tests

`src/lib/services/commissions.test.ts` — covers commission amount computation, rule-based commission creation, duplicate-lead rejection, payout creation, 10000bps cap enforcement, and payout status transitions. Tests use real Prisma against the dev database (same pattern as `brokers.test.ts`). Note: vitest cannot currently execute in this environment due to a missing `@rolldown/binding-wasm32-wasi` native binding (pre-existing issue affecting all vitest suites).
