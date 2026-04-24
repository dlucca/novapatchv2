# Subscription Self-Service — Design Spec

**Status:** Approved — ready for implementation plan.

**Scope:** Five authenticated endpoints under `/me/subscriptions/*` that let a customer list their subscriptions and mutate them (pause, resume, cancel, change frequency). All operations are pure backend — no payment gateway, no charges.

---

## Goals

1. Customer can see their own subscriptions.
2. Customer can pause an active sub (no charges while paused).
3. Customer can resume a paused sub; new `nextBillingDate = today + intervalDays` (fresh cycle).
4. Customer can cancel any non-terminal sub; cancellation is terminal (`canceledAt` recorded).
5. Customer can change frequency (30 → 60 → 90 or any combination) on active or paused subs; `intervalDays` updates and `nextBillingDate` is recalculated to `today + newIntervalDays`.
6. No cross-customer leakage: accessing another user's subscription id returns `404`, not `403`.

## Non-Goals

- UI in the Next.js app. That's a follow-up plan.
- Admin lifecycle endpoints (`/admin/subscriptions/*`). Follow-up plan.
- Hooks that emit `subscription.paused` / `subscription.resumed` events for email notifications. Those ride with the Resend plan.
- Persisting a reason for pausing / cancelling. YAGNI today.
- Idempotency headers. No charges happen in this surface; an accidentally repeated `POST /.../cancel` on a canceled sub returns `409`, which is the correct failure mode.

---

## Architecture

Three layers, each with a single responsibility:

1. **Pure service** — `applySubscriptionAction(sub, action, getNow, intervalDays?)`. Encodes the state transition matrix. Given a subscription's current state and a requested action, returns either an update payload (status / nextBillingDate / intervalDays / canceledAt) or a rejection with `currentStatus` + `action`. No I/O.

2. **Repo** — `listByCustomerId`, `getByIdForCustomer`, `updateStatus`. Thin Drizzle wrappers that enforce the ownership invariant (cross-customer reads return `undefined`).

3. **Route handlers** — five factory-mounted routes under `/me/subscriptions/*`. Each handler: fetch sub via repo → call pure service → persist via repo → serialize → return.

### State transition matrix

| From \ Action | `pause` | `resume` | `cancel` | `frequency` |
|---|---|---|---|---|
| `active` | ✅ → `paused` | 409 | ✅ → `canceled` | ✅ updates interval + nextBillingDate |
| `paused` | 409 | ✅ → `active`, nextBillingDate = today + intervalDays | ✅ → `canceled` | ✅ updates interval + nextBillingDate (stays `paused`) |
| `canceled` | 409 | 409 | 409 | 409 |
| `past_due` | 409 | 409 | ✅ → `canceled` | 409 |
| `delayed_oos` | 409 | 409 | ✅ → `canceled` | 409 |

**Why billing-problem states (`past_due`, `delayed_oos`) only allow cancel:** the daily billing job owns those states. A self-service "pause" or "resume" from the customer would confuse the job's retry schedule. Cancel is always OK — it unambiguously removes the sub from the job's query.

**Frequency from `paused`:** the handler updates `intervalDays` and also recomputes `nextBillingDate = today + newIntervalDays`. The sub stays `paused`. The new date is technically "useless" until the customer resumes, but keeping the field consistent with the new cadence is cheaper than special-casing the computation at resume time.

### Transition semantics (locked)

- **`resume`** → `nextBillingDate = getNow() + intervalDays` (UTC arithmetic, `YYYY-MM-DD` format, same as checkout).
- **`frequency`** → `intervalDays = body.intervalDays`; `nextBillingDate = getNow() + body.intervalDays`. Works on both `active` and `paused`.
- **`cancel`** → `status = "canceled"`, `canceledAt = getNow()`. Terminal.
- **`pause`** → `status = "paused"`. `nextBillingDate` is left untouched (it becomes moot; daily job filters by `status='active'`).

---

## HTTP Contract

All routes require `Authorization: Bearer <clerk_jwt>`. The existing `authMiddleware` guards them.

### `GET /me/subscriptions`

Returns the caller's subscriptions, most-recent first.

```json
{
  "subscriptions": [
    {
      "id": "uuid",
      "productSlug": "sleep",
      "intervalDays": 30,
      "unitPrice": 36000,
      "quantity": 1,
      "market": "mx",
      "currency": "MXN",
      "status": "active",
      "nextBillingDate": "2026-05-24",
      "createdAt": "2026-04-24T12:34:56.000Z",
      "updatedAt": "2026-04-24T12:34:56.000Z",
      "canceledAt": null
    }
  ]
}
```

Order: `createdAt DESC`. No pagination v1. If a customer accumulates dozens of subs someday, cursor pagination can be added without changing the response envelope.

### `POST /me/subscriptions/:id/pause`

Body: empty. Response 200: the updated subscription (same element shape as above).

### `POST /me/subscriptions/:id/resume`

Body: empty. Response 200: updated subscription.

### `POST /me/subscriptions/:id/cancel`

Body: empty. Response 200: updated subscription.

### `POST /me/subscriptions/:id/frequency`

```json
{ "intervalDays": 60 }
```

Zod: `z.object({ intervalDays: z.union([z.literal(30), z.literal(60), z.literal(90)]) })`.

Response 200: updated subscription.

### Error envelope

All errors use the canonical `{error: {code, message, details?}}` shape.

| HTTP | `code` | Trigger |
|---|---|---|
| 400 | `validation_failed` | Zod failure (frequency body) |
| 401 | `auth_missing` / `auth_malformed` / `auth_invalid` | middleware |
| 404 | `not_found` | Sub doesn't exist **or** belongs to another customer. Same response either way — no information leak. |
| 409 | `subscription_invalid_state` | Action not allowed from current status. `details: { currentStatus, action }` for precise frontend messaging. |

New `ApiErrorCode` literal added: `subscription_invalid_state`. No new HTTP statuses — `409` is already in `ApiErrorStatus`.

---

## File Structure

**New:**
- `apps/api/src/services/subscription-actions.ts` — pure transition engine
- `apps/api/test/services/subscription-actions.test.ts`
- `apps/api/src/repos/subscriptions.ts` — `listByCustomerId`, `getByIdForCustomer`, `updateStatus`
- `apps/api/test/repos/subscriptions.test.ts`
- `apps/api/src/routes/subscriptions.ts` — `createSubscriptionRoutes({db, getNow})`
- `apps/api/test/routes/subscriptions.test.ts`

**Modify:**
- `apps/api/src/lib/errors.ts` — add `subscription_invalid_state` to `ApiErrorCode`
- `apps/api/src/routes/me.ts` — mount `createSubscriptionRoutes` (unconditional — no gateway needed)

---

## Testing

### Pure service tests

Exhaustive matrix: 20 cells (5 states × 4 actions) asserted. Date arithmetic verified with a fixed `getNow = () => new Date("2026-05-01T00:00:00Z")` fixture:
- `resume` from `paused` (intervalDays=30) → `nextBillingDate = "2026-05-31"`.
- `frequency` from `active` 30 → 90 → `intervalDays=90`, `nextBillingDate = "2026-07-30"`.
- `frequency` from `paused` 30 → 60 → stays `paused`, `intervalDays=60`, `nextBillingDate = "2026-06-30"`.

### Repo integration tests

- `listByCustomerId` returns only the caller's rows, sorted by `createdAt DESC`.
- `getByIdForCustomer` returns `undefined` when the id belongs to another customer (cross-customer invariant).
- `updateStatus` persists the new status, nextBillingDate, intervalDays, canceledAt. Returning a fresh row.

### Route integration tests

End-to-end with stub Clerk verifier + real DB. Minimum matrix:

1. 401 without Authorization on each of the 5 endpoints (parameterized).
2. `GET` happy path returns list in `createdAt DESC`.
3. `GET` returns only caller's subs (seed two customers, assert isolation).
4. 404 when `:id` doesn't exist.
5. 404 when `:id` belongs to another customer (no leak).
6. `pause` on `active` → 200, status becomes `paused`.
7. `pause` on `paused` → 409 `subscription_invalid_state` with `details.currentStatus="paused"`.
8. `resume` on `paused` → 200, `nextBillingDate = today + intervalDays`.
9. `cancel` on any non-terminal status → 200, `canceledAt` populated.
10. `cancel` on `canceled` → 409.
11. `frequency` with invalid body (e.g. `intervalDays: 45`) → 400 `validation_failed`.
12. `frequency` on `active` 30 → 90 → 200, intervalDays + nextBillingDate updated.
13. `frequency` on `paused` → 200, status stays `paused`.
14. `frequency` on `past_due` → 409.

### Seeding

Tests insert subs via the existing `persistOrder` (from the checkout plan) to exercise the exact shape customers see in production. No standalone `subscriptions` insert fixtures — less drift risk.

---

## Out-of-Scope Follow-ups

- Frontend UI (`/cuenta/suscripciones` list + per-sub actions).
- Admin lifecycle endpoints (`GET /admin/subscriptions` + per-sub admin overrides).
- Event hooks for Resend emails (`subscription.paused`, `subscription.resumed`, `subscription.canceled`, `subscription.frequency_changed`).
- Pagination on `GET /me/subscriptions`.
- Persisting cancellation / pause reasons (add a nullable `reason` column + body field in a follow-up).
- Reactivation of a canceled subscription (product decision — currently `canceled` is terminal).
- Mid-cycle proration when changing frequency. Current semantics: the last charge is honored as-is, the new interval starts from `today`. Customers are not re-charged or refunded on frequency change. This matches most SaaS subscription flows.
