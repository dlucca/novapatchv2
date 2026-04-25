# Schema Extension — Design Spec

**Status:** Approved — ready for implementation plan.
**Roadmap reference:** Plan #1 of [`docs/superpowers/ROADMAP.md`](../ROADMAP.md).
**Scope:** Extend the Drizzle/Postgres schema to support the recurring billing engine, webhook idempotency, fulfillment tracking, multi-gateway customer vault, and per-customer country/address. Establishes the data model required by Stripe MX integration (Plan #5), the worker scheduler (Plan #8), and the admin (Plans #10–#11).

---

## Goals

1. Replace the conflated `subscription_billings` table with two PRD-aligned tables: `subscription_runs` (one row per scheduled cycle) and `payment_attempts` (one row per gateway charge attempt).
2. `payment_attempts` is **universal** — it covers initial checkout charges and recurring subscription charges, plus future refund/dispute attempts. Provides a single source of truth for charge history.
3. Add `webhook_events` for gateway webhook idempotency and debugging.
4. Migrate `customers` to a JSONB `gateway_customer_ids`, drop dead Openpay/MercadoPago columns, add `country`, add `default_shipping_address`.
5. Add fulfillment tracking columns to `orders` (`fulfillment_status` + 3 timestamps).
6. Backfill the existing checkout flow to write a `payment_attempts` row alongside the persisted order.
7. All changes ship in a single Drizzle migration. No production data exists; dev/test DB resets cleanly.

## Non-Goals

- Implementing the worker that materializes runs or processes attempts (Plan #8).
- Webhook receiver endpoint (Plan #5).
- Admin UI for fulfillment queue (Plan #11).
- Customer-facing endpoint to edit `default_shipping_address` (future).
- Retry/dunning policy or email notifications (Plan #8 / #13).
- Refund / dispute flows (Plan #5 webhooks + Plan #11 admin).
- Migration of `default_shipping_address` from existing checkouts (column is nullable; future checkouts populate it).
- Fulfillment audit trail (`order_events` table) — deferred until real demand.

---

## Decisions log

These reflect the brainstorming Q&A on 2026-04-25:

| # | Topic | Decision |
|---|---|---|
| 1 | `subscription_billings` strategy | **Drop** and replace with `subscription_runs` + `payment_attempts`. No production data to migrate. |
| 2 | Gateway customer IDs storage | **JSONB** column `gateway_customer_ids`. Drop legacy `openpay_customer_id` + `mercadopago_customer_id`. |
| 3 | Customer addresses | Single `default_shipping_address` JSONB column. No `customer_addresses` table for v1. |
| 4 | `webhook_events` schema | Minimal + `event_type` + `processed_at`. No `attempt_count` or `processing_error` for v1. |
| 5 | Fulfillment status on orders | Column + 3 timestamps on `orders`. No `order_events` timeline table for v1. |
| 6 | Customer country | Add `customers.country text NOT NULL DEFAULT 'mx'`. |
| 7 | `subscription_runs` extra fields | PRD literal + `cycle_number int`. No `expected_amount` / `expected_currency`. |
| 8 | `payment_attempts` scope | **Universal** — covers initial + recurring. XOR constraint on `(order_id, subscription_run_id)`. Backfill checkout to write here. |

---

## Schema changes

### `customers` (modify)

**Drop columns:**
- `openpay_customer_id`
- `mercadopago_customer_id`

**Add columns:**
- `gateway_customer_ids JSONB NOT NULL DEFAULT '{}'::jsonb`
  - Shape: `{ stripe?: string, mercadopago?: string }`.
- `default_shipping_address JSONB` (nullable)
  - Shape: `{ line1: string, line2?: string, city: string, state: string, postalCode: string, country: string }` (matches the snapshot already stored on `orders.shipping_address`).
- `country TEXT NOT NULL DEFAULT 'mx'`
  - Set at signup / first checkout from the resolved market. Updates only if the customer explicitly switches country.

**Unchanged columns:** `id`, `clerk_user_id`, `email`, `default_card_id`, `default_card_brand`, `default_card_last4`, `recurring_consent_at`, `created_at`, `updated_at`.

### `orders` (modify)

**Add columns:**
- `fulfillment_status TEXT NOT NULL DEFAULT 'pending'`
  - Allowed values: `pending | picking | shipped | delivered`.
- `picked_at TIMESTAMPTZ` (nullable) — set on `pending → picking`.
- `shipped_at TIMESTAMPTZ` (nullable) — set on `picking → shipped`.
- `delivered_at TIMESTAMPTZ` (nullable) — set on `shipped → delivered`.

**Unchanged:** all other columns. `payment_charge_id` and `payment_provider` are kept as denormalization for fast primary-charge lookup; the source of truth becomes `payment_attempts`.

### `subscription_billings` (drop)

Drop the entire table. Replaced by `subscription_runs` + `payment_attempts`.

### `subscription_runs` (new)

```ts
{
  id: uuid (pk, default random),
  subscriptionId: uuid (fk → subscriptions.id, on delete cascade, NOT NULL),
  cycleNumber: integer (NOT NULL, 1-indexed),
  scheduledFor: timestamptz (NOT NULL — when this run should be processed),
  status: text (NOT NULL, default 'pending'),
  attemptCount: integer (NOT NULL, default 0),
  startedAt: timestamptz (nullable — set when worker picks it up),
  finishedAt: timestamptz (nullable — set when status becomes terminal),
  orderId: uuid (fk → orders.id, nullable — set on succeeded),
  failureReason: text (nullable — set on failed/abandoned),
  createdAt: timestamptz (NOT NULL, default now),
}
```

**Status values:** `pending | processing | succeeded | failed | abandoned`.

**Status transitions:**
```
pending → processing → succeeded
                    └→ failed (will retry)
pending → ... → failed → (retry budget exhausted) → abandoned
```

`abandoned` = retries exhausted; the parent `subscriptions.status` transitions to `past_due` separately by the worker (out-of-scope for this plan).

**Constraints:**
- `UNIQUE(subscription_id, scheduled_for)` — guarantees idempotent materialization. The worker's cron can run multiple times without creating duplicate runs for the same subscription/cycle.

**Indexes:**
- `subscription_runs_status_scheduled_for_idx` on `(status, scheduled_for)` — supports the worker's primary processing query: "next runs where `status = 'pending'` AND `scheduled_for <= NOW()`, ordered by `scheduled_for ASC`".
- `subscription_runs_subscription_id_idx` on `(subscription_id)` — list runs for a subscription (admin / customer dashboard).

### `payment_attempts` (new)

```ts
{
  id: uuid (pk, default random),

  orderId: uuid (fk → orders.id, on delete cascade, nullable),
  subscriptionRunId: uuid (fk → subscription_runs.id, on delete cascade, nullable),

  provider: text (NOT NULL),
  providerChargeId: text (nullable — null while attempt is in flight; set on response),
  providerCustomerId: text (nullable — null for guest checkouts),
  amount: integer (NOT NULL — cents),
  currency: text (NOT NULL),
  status: text (NOT NULL),
  failureCode: text (nullable),
  providerResponse: jsonb (nullable — raw gateway response, redacted of sensitive data),
  attemptedAt: timestamptz (NOT NULL, default now),
}
```

**Provider values (initial set):** `stripe | mercadopago | stub`.

**Status values:** `succeeded | failed | refunded | pending`.

**Constraints:**
- `CHECK ((order_id IS NULL) <> (subscription_run_id IS NULL))` — XOR. Exactly one parent must be set.
- `UNIQUE(provider, provider_charge_id) WHERE provider_charge_id IS NOT NULL` — partial unique index. Enables webhook idempotency: a `charge.succeeded` webhook for `(stripe, ch_xxx)` can be matched to its `payment_attempts` row.

**Indexes:**
- `payment_attempts_order_id_idx` on `(order_id)` — list charges for an order.
- `payment_attempts_subscription_run_id_idx` on `(subscription_run_id)` — list attempts for a run.
- `(provider, provider_charge_id)` is already covered by the partial unique index — no additional index needed.
- `payment_attempts_status_attempted_at_idx` on `(status, attempted_at DESC)` — failed-charges admin dashboard.

### `webhook_events` (new)

```ts
{
  id: uuid (pk, default random),
  provider: text (NOT NULL),
  eventId: text (NOT NULL — provider's event id, e.g. evt_xxx),
  eventType: text (NOT NULL — e.g. 'charge.succeeded'),
  payload: jsonb (NOT NULL — full webhook body),
  receivedAt: timestamptz (NOT NULL, default now),
  processedAt: timestamptz (nullable — null = unprocessed; timestamp = processed OK),
}
```

**Constraints:**
- `UNIQUE(provider, event_id)` — gateway idempotency. Stripe/MP retry sends the same `event_id`; second insert is rejected, handler is not re-run.

**Indexes:**
- `webhook_events_unprocessed_idx` on `(received_at)` `WHERE processed_at IS NULL` — partial index supporting "find unprocessed events" queries.
- `webhook_events_provider_event_type_idx` on `(provider, event_type, received_at DESC)` — admin/debugging filters.

---

## Code changes

### Schema files (`apps/api/src/db/schema/`)

| File | Action |
|---|---|
| `customers.ts` | Modify — drop legacy gateway-id columns; add `gateway_customer_ids`, `default_shipping_address`, `country`. |
| `orders.ts` | Modify — add `fulfillment_status` + 3 timestamps. Order items unchanged. |
| `subscriptions.ts` | Modify — drop `subscriptionBillings` table definition (and its types). Keep `subscriptions`. |
| `subscription-runs.ts` | **New** — `subscriptionRuns` table + types. |
| `payment-attempts.ts` | **New** — `paymentAttempts` table + types. |
| `webhook-events.ts` | **New** — `webhookEvents` table + types. |
| `discounts.ts` | Unchanged. |
| `influencers.ts` | Unchanged. |
| `index.ts` | Re-export the 3 new files; remove `subscriptionBillings` re-export. |

### Migration

Single Drizzle migration generated by `bun run --filter @novapatch/api db:generate`. Filename will be `0004_<auto-generated>.sql`.

The migration includes (in order):
1. Drop `customers.openpay_customer_id`, `customers.mercadopago_customer_id`.
2. Add `customers.gateway_customer_ids`, `customers.default_shipping_address`, `customers.country`.
3. Add `orders.fulfillment_status`, `orders.picked_at`, `orders.shipped_at`, `orders.delivered_at`.
4. Drop `subscription_billings` table.
5. Create `subscription_runs` table + indexes + UNIQUE.
6. Create `payment_attempts` table + indexes + CHECK + partial UNIQUE.
7. Create `webhook_events` table + indexes + UNIQUE.

Run via existing `db:migrate` script. Test DB picks it up automatically through `useTestDb()`.

### Repos (`apps/api/src/repos/`)

**Modify:**

- **`customers.ts`** — `upsertCustomerByClerkUserId` signature gains `market: MarketId`. Sets `country = market` on insert; preserves `country` on subsequent upserts (does not overwrite if user later changes country in profile). Type updates flow through callers (`me.ts`, `checkout.ts`).
- **`orders.ts`** — `persistOrder` accepts an additional `paymentAttempt` payload (provider, providerChargeId, providerCustomerId?, amount, currency, providerResponse?) and inserts the corresponding `payment_attempts` row in the same transaction.

**Create:**

- **`subscription-runs.ts`** — initial functions:
  - `materializeRun(db, { subscriptionId, cycleNumber, scheduledFor }) → { runId, inserted: boolean }` — uses `INSERT ... ON CONFLICT (subscription_id, scheduled_for) DO NOTHING RETURNING id` so duplicate cron runs are idempotent.
  - `getNextRunsForProcessing(db, { limit }) → SubscriptionRun[]` — `SELECT FOR UPDATE SKIP LOCKED` (worker uses this; not invoked from API yet but exposed for testing).
  - `markStatus(db, { id, status, ...optional fields })` — single function that updates status + denormalized fields (started_at, finished_at, attempt_count, order_id, failure_reason).
- **`payment-attempts.ts`**:
  - `recordAttempt(db, payload) → { id }` — inserts a single attempt. Validates XOR at type level (TS overload: either `orderId` or `subscriptionRunId`).
  - `findByProviderChargeId(db, { provider, providerChargeId }) → PaymentAttempt | null` — for webhook handler lookup.
- **`webhook-events.ts`**:
  - `recordEvent(db, payload) → { id, inserted: boolean }` — uses `INSERT ... ON CONFLICT (provider, event_id) DO NOTHING RETURNING id`. If `inserted: false`, the webhook handler skips processing.
  - `markProcessed(db, id)` — sets `processed_at = NOW()`.
  - `findUnprocessed(db, { provider?, limit })` — returns unprocessed events for retry tooling.

### Routes (`apps/api/src/routes/checkout.ts`)

Backfill the payment-attempts write within the existing successful-charge transaction. After the gateway returns success, `persistOrder` (now extended) inserts the `payment_attempts` row with `orderId`, `provider`, `providerChargeId`, `providerCustomerId` (if present), `status: 'succeeded'`, `amount: order.total`, `currency: order.currency`, and the redacted gateway response. The legacy `orders.payment_charge_id` and `orders.payment_provider` columns continue to be populated for backward compatibility.

No new endpoints in this plan.

### `apps/api/src/lib/types` (or equivalent)

Define the shared shape constants:
- `SubscriptionRunStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'abandoned'`
- `PaymentAttemptStatus = 'succeeded' | 'failed' | 'refunded' | 'pending'`
- `PaymentProvider = 'stripe' | 'mercadopago' | 'stub'`
- `FulfillmentStatus = 'pending' | 'picking' | 'shipped' | 'delivered'`
- `ShippingAddress` interface (formalized; matches existing `orders.shipping_address` shape).

---

## Testing

All tests use `useTestDb()` which re-runs migrations from scratch and truncates between test cases.

### Schema-level (DB constraint) tests

- **`test/db/payment-attempts-xor.test.ts`**:
  - Insert with only `orderId` → succeeds.
  - Insert with only `subscriptionRunId` → succeeds.
  - Insert with both → throws check constraint violation matching `/payment_attempts.*check/i`.
  - Insert with neither → throws.
- **`test/db/payment-attempts-charge-id-unique.test.ts`**:
  - Two attempts with same `(provider, providerChargeId)` → second throws unique violation.
  - Two attempts with same `provider` but `providerChargeId` NULL on both → both succeed (partial index excludes NULL).
- **`test/db/subscription-runs-unique.test.ts`**:
  - Two runs with same `(subscriptionId, scheduledFor)` → second throws.
  - Two runs with different `scheduledFor` for same subscription → both succeed.
- **`test/db/webhook-events-unique.test.ts`**:
  - Two events with same `(provider, eventId)` → second throws.
  - Two events with same `eventId` but different `provider` → both succeed.

### Repo tests

- **`test/repos/customers.test.ts`** (extend existing):
  - `upsertCustomerByClerkUserId({ market: 'mx' })` sets `country: 'mx'` on insert.
  - Re-upsert of the same customer with `market: 'ar'` does **not** overwrite the existing `country`.
- **`test/repos/payment-attempts.test.ts`** (new):
  - `recordAttempt({ orderId, ... })` inserts and returns id.
  - `recordAttempt({ subscriptionRunId, ... })` inserts and returns id.
  - `findByProviderChargeId(...)` returns the row when it exists.
  - `findByProviderChargeId(...)` returns null when not found.
- **`test/repos/subscription-runs.test.ts`** (new):
  - `materializeRun` first call returns `{ inserted: true }`.
  - `materializeRun` with same key returns `{ inserted: false }` (no throw, no duplicate).
  - `getNextRunsForProcessing({ limit: 10 })` returns only `pending` runs with `scheduledFor <= NOW()`, ordered ascending.
  - `markStatus` transitions update the row correctly.
- **`test/repos/webhook-events.test.ts`** (new):
  - `recordEvent` first call returns `{ inserted: true }`.
  - `recordEvent` with same `(provider, eventId)` returns `{ inserted: false }`.
  - `markProcessed` sets `processed_at`.
  - `findUnprocessed` returns only events with `processed_at IS NULL`.

### Route-level test additions

- **`test/routes/checkout.test.ts`**: assert that after a successful checkout, exactly one `payment_attempts` row exists with the expected `(orderId, status: 'succeeded', amount: order.total, currency)`. The XOR constraint guarantees `subscriptionRunId` is NULL.

### Existing tests

All existing tests continue to pass after the schema migration. The only modifications needed are:
- Tests that insert into `customers` directly need to provide `country` (or rely on the default) and not the dropped `openpayCustomerId` / `mercadopagoCustomerId` fields.
- Tests referencing `subscriptionBillings` (if any) need to be deleted or migrated to the new tables.

---

## Behavior notes & edge cases

- **`gateway_customer_ids` default**: `{}` empty object, not NULL. Avoids null checks in code; readers do `obj.stripe ?? null`.
- **`country` immutability**: this plan does not expose an endpoint to change country. The column is mutable in the DB, but only the admin (future) or a dedicated profile-edit flow can touch it. The signup/first-checkout sets it once.
- **`default_shipping_address` lifecycle**: not populated in this plan. Future checkouts (Plan #6) will copy the shipping address used at checkout into this column the first time, and update it whenever the customer changes their default. Existing customers without a default keep `NULL` and the checkout form starts empty.
- **`fulfillment_status` defaulting to 'pending'** means orders move into the fulfillment queue automatically on creation. Admin (Plan #11) provides the UI for transitions.
- **Backfill of `payment_attempts` for historic orders**: not needed — there is no production data. Existing dev/test data resets with the migration.
- **`subscription_runs.attemptCount` denormalization**: kept in sync by the worker. This plan only creates the column; updates happen in Plan #8.
- **Webhook `payload` JSONB size**: Stripe events can be large (~10–20 KB). Postgres TOAST handles this transparently; no special handling needed.
- **PII / PCI**: `payment_attempts.providerResponse` MUST be redacted before storage. Specifically, never store `card.number`, `card.cvc`, `card.exp_month/year`. The redaction utility belongs to Plan #5 (Stripe integration); this plan only enforces the column type and a comment in the schema file documenting the requirement.

---

## Out-of-Scope Follow-ups

- Worker that materializes runs from `subscriptions.next_billing_date` (Plan #8).
- Worker that processes pending runs and creates `payment_attempts` (Plan #8).
- Webhook receiver endpoint (`POST /webhooks/stripe`) that writes to `webhook_events` (Plan #5).
- Admin endpoints to read fulfillment queue / mark transitions (Plan #11).
- Customer endpoint to read/edit `default_shipping_address` (future).
- Refund / dispute attempt rows (Plan #5 + #11).
- `customer_addresses` table for multiple saved addresses (future).
- `order_events` audit trail table (future, when admin demands it).
- Backfill `payment_attempts` for historic orders (no production data exists).
- `expected_amount` / `expected_currency` snapshot on `subscription_runs` (out — sub price doesn't change in v1).
