# Checkout (`POST /me/checkout`) — Design Spec

**Status:** Approved — ready for implementation plan.
**Scope:** Authenticated checkout that charges a payment gateway, persists an order, and creates subscriptions for any recurring line items. Gateway implementation is deferred — this spec targets a `PaymentGateway` interface with a test stub; the concrete adapter (Openpay / MercadoPago / Stripe) is a follow-up plan once the provider is picked.

---

## Goals

1. Accept a validated cart + payment token from an authenticated customer, compute the final quote server-side, charge a payment gateway, persist the resulting `order` / `order_items` / `discount_redemption` / `subscriptions` atomically, and return the order + subscriptions.
2. Never double-charge on retry — `Idempotency-Key` header is required.
3. Never persist "zombie" rows when a charge fails — persistence happens **after** a successful charge.
4. Never let a declined charge burn a discount code's `max_uses` counter.
5. Stay provider-agnostic via a `PaymentGateway` interface; a real adapter is a localized change.

## Non-Goals

- Guest checkout (no email-only path). Clerk auth is required.
- Shipping quote from Envia. `market.shippingFlat` is used.
- Transactional emails. A separate plan wires `order.paid` / `subscription.created` events to Resend.
- Real gateway adapter (Openpay / MercadoPago / Stripe). The stub satisfies this plan; adapter is a follow-up.
- Webhook ingestion (`/webhooks/openpay` etc.).
- Retry/recovery if persistence fails after a successful charge. The response is 500 with `details.chargeId`; recovery is manual.
- Pause / resume / cancel / frequency changes on subscriptions. This plan only **creates** subscriptions.

---

## Architecture

One authenticated route — `POST /me/checkout` — orchestrates pure functions and atomic DB operations. The complexity lives in the handler; every piece it calls is either a pure function or a single-transaction repo operation.

### New units

1. **`PaymentGateway` interface** — `apps/api/src/lib/payment-gateway.ts`

    ```typescript
    export interface ChargeInput {
      token: string;
      amount: number;            // integer cents
      currency: string;
      deviceSessionId?: string;
      customerRef?: string;      // the gateway's customer/vault id, if any
    }

    export interface ChargeResult {
      chargeId: string;
      status: "succeeded" | "declined";
      declineReason?: string;    // present when status === "declined"
    }

    export interface PaymentGateway {
      charge(input: ChargeInput): Promise<ChargeResult>;
    }
    ```

    Plus a stub factory for tests:

    ```typescript
    export function createStubGateway(opts: {
      defaultOutcome?: "succeeded" | "declined" | "throw";
      outcomeByToken?: Record<string, "succeeded" | "declined" | "throw">;
      declineReason?: string;
    }): PaymentGateway
    ```

    Semantics:
    - `"succeeded"` returns `{chargeId: "stub_<uuid>", status: "succeeded"}`.
    - `"declined"` returns `{chargeId: "stub_<uuid>", status: "declined", declineReason}`.
    - `"throw"` throws `new Error("gateway timeout")` (simulates network/5xx).

2. **`createOrderFromCart` service** — `apps/api/src/services/create-order.ts`

    A pure function. Takes the quote + customer + shipping address + discount result + payment metadata, returns the plain-object shapes of the rows to insert. No DB access. No gateway calls.

    ```typescript
    export interface CreateOrderInput {
      quote: PricingQuote;
      customerId: string;
      market: Market;
      shippingAddress: ShippingAddress;
      paymentProvider: string;  // e.g. "stub" | "openpay" | "mercadopago" | "stripe"
      paymentChargeId: string;  // from gateway
      idempotencyKey: string;
      discountResult?: ValidateDiscountResult & { ok: true };
      items: readonly CartItemInput[];
    }

    export interface CreateOrderOutput {
      order: NewOrder;
      orderItems: NewOrderItem[];
      redemption?: NewDiscountRedemption;
      subscriptions: NewSubscription[];
    }

    export function createOrderFromCart(input: CreateOrderInput): CreateOrderOutput
    ```

    Rules:
    - `order.status = "paid"` (we only call this after charge succeeded).
    - `order.total = quote.total`, same for subtotal/tax/shipping/discountAmount.
    - `order.idempotencyKey = input.idempotencyKey`.
    - One `order_items` row per cart line, with `unitPrice` from the quote line (already reflects frequency discount), `isSubscription` + `intervalDays` + `discountPct` mirrored from the line.
    - If `discountResult` is present → one `redemption` row with `{discountCodeId, orderId (later filled by persistOrder), customerId, discountAmount: quote.discountAmount, influencerId: discountResult.code.influencerId ?? null, commissionAmount: null}`. Commission calculation is a follow-up plan.
    - One `subscriptions` row per cart line where `subscription !== undefined`, with `status: "active"`, `intervalDays: line.interval`, `nextBillingDate: today + intervalDays`, `unitPrice: line.unitPrice` (the per-cycle price with frequency discount baked in), `originalOrderId` filled by `persistOrder`.

3. **`persistOrder` repo** — `apps/api/src/repos/orders.ts`

    One function that runs inside a DB transaction:

    ```typescript
    export async function persistOrder(
      db: Db,
      input: CreateOrderOutput,
    ): Promise<{ orderId: string; subscriptionIds: string[] }>
    ```

    Steps inside `db.transaction`:
    1. Insert `order`, capture `orderId`.
    2. Insert all `order_items` with `orderId`.
    3. If `redemption` present: insert `redemption` with `orderId` + `UPDATE discount_codes SET times_used = times_used + 1 WHERE id = ?`.
    4. For each `subscription`: insert with `originalOrderId = orderId`, capture ids.

    Returns `{orderId, subscriptionIds}`. If any step throws, the whole transaction rolls back.

4. **`POST /me/checkout` route** — `apps/api/src/routes/checkout.ts`

    Factory `createCheckoutRoutes(deps: {db, gateway, getNow?})` mounted under `/me` inside `createApp` when `gateway` is provided.

### Request flow

```
1. Clerk middleware authenticates → {clerkUserId, email}
2. Upsert customer by clerkUserId (existing repo fn)
3. Zod validates body
4. Read Idempotency-Key header; if missing → 400 idempotency_key_missing
5. Lookup existing order by idempotencyKey; if found → return 200 with same shape (replay)
6. Resolve market, calculateQuote (no discount) → draft
7. If discountCode present → validateDiscount using draft.subtotal
   If invalid → 400 with the corresponding discount_* code
8. calculateQuote(items, market, discount?) → final quote
9. Require recurringConsent === true if any line is subscription; else 400 validation_failed
10. gateway.charge({token: paymentToken, amount: quote.total, currency, deviceSessionId?, customerRef?: null})
    - If throws → 502 gateway_error
    - If status === "declined" → 402 payment_declined (body: {declineReason})
11. createOrderFromCart({quote, customerId, market, shippingAddress, paymentProvider, paymentChargeId, idempotencyKey, discountResult?, items})
12. persistOrder(db, output) inside transaction
    - If this throws → 500 internal_error with details: {chargeId} (operator recovers manually)
13. Return 201 {orderId, chargeId, quote, subscriptions}
```

---

## Request / Response Contract

### Request

```
POST /me/checkout
Authorization: Bearer <clerk_jwt>
Idempotency-Key: <uuid-v4>
Content-Type: application/json

{
  "market": "mx",
  "items": [
    { "slug": "energy", "quantity": 2 },
    { "slug": "sleep", "quantity": 1, "subscription": { "interval": 30 } }
  ],
  "shippingAddress": {
    "line1": "Av. Insurgentes Sur 1234",
    "line2": "Depto 5B",
    "city": "Ciudad de México",
    "state": "CDMX",
    "postalCode": "03020",
    "country": "MX"
  },
  "paymentToken": "tok_XXX",
  "deviceSessionId": "ds_XXX",
  "recurringConsent": true,
  "discountCode": "WELCOME10"
}
```

Zod rules:
- `market` — string, resolved via `isMarketId`; unknown → `market_unknown`.
- `items` — non-empty array of `{slug (enum), quantity (int >=1), subscription? {interval 30|60|90}}`.
- `shippingAddress.*` — all strings, `line1`/`city`/`state`/`postalCode`/`country` required; `line2` optional. No further validation (address normalization is a separate concern).
- `paymentToken` — non-empty string 1..255.
- `deviceSessionId` — optional string 1..255.
- `recurringConsent` — optional boolean. If any item has `subscription`, the handler rejects with `validation_failed` if `recurringConsent !== true`.
- `discountCode` — optional string 1..64.

### Success — `201 Created`

```json
{
  "orderId": "b0f7...-uuid",
  "chargeId": "stub_abc123",
  "quote": { /* full PricingQuote */ },
  "subscriptions": [
    {
      "id": "e31a...-uuid",
      "slug": "sleep",
      "interval": 30,
      "nextBillingDate": "2026-05-24"
    }
  ]
}
```

### Error envelope

All errors: `{ "error": { "code": ApiErrorCode, "message": string, "details"?: unknown } }`.

| HTTP | `code` | Trigger |
|---|---|---|
| 400 | `idempotency_key_missing` | `Idempotency-Key` header not present |
| 400 | `validation_failed` | Zod errors; also `recurring_consent_required` when omitted for a sub cart (we surface it in `details`) |
| 400 | `market_unknown` | market id not in `MARKETS` |
| 400 | `product_not_found` | slug not in catalog |
| 400 | `discount_not_found` / `discount_below_minimum` / `discount_max_uses_reached` / `discount_max_per_customer_reached` | reused from `/discounts/validate`. Note: `/discounts/validate` returns 200 `{valid:false}` for these (soft pre-check); checkout returns 400 (hard commit) |
| 401 | `auth_*` | Clerk middleware |
| 402 | `payment_declined` | gateway returned `{status: "declined"}`. `details: {declineReason}` |
| 502 | `gateway_error` | gateway threw / timed out — we don't know if the charge went through |
| 500 | `internal_error` | persistence failed after charge succeeded — `details: {chargeId}` for manual recovery |

New `ApiErrorCode` literals added: `idempotency_key_missing`, `payment_declined`, `gateway_error`.

---

## Data Model Changes

One column + one partial unique index on `orders`:

```sql
ALTER TABLE orders ADD COLUMN idempotency_key text NULL;
CREATE UNIQUE INDEX orders_idempotency_key_unique
  ON orders (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
```

The partial index allows old rows with `NULL` keys to coexist; every row inserted by `/me/checkout` carries a non-null key.

No other tables change. `order_items`, `subscriptions`, `discount_redemptions` already have the columns this plan needs.

---

## Key Behaviors Locked Down

**Charge-first, persist-after.** The handler calls `gateway.charge()` before any DB writes. If charge fails, nothing is written. If charge succeeds but persistence fails, we respond 500 with `details.chargeId` so an operator can reconcile. The alternative (persist `order status=pending` → charge → mark `paid`/`failed`) creates zombie rows that pollute reports.

**Idempotent replay.** `Idempotency-Key` is required. If a request arrives with a key already present on an `orders` row, we respond 200 with the existing order + subscriptions (same shape as the original 201) without charging. This makes client retries safe.

**Discount redemption only on success.** The `discount_redemptions` row and the `times_used++` update happen **inside the persist transaction**, which only runs after a successful charge. A declined charge leaves the code untouched — abusers can't burn `max_uses` with fake cards.

**Subscription creation semantics.** One `subscriptions` row per recurring line. `status = "active"`. `nextBillingDate = today + intervalDays` (clock source injected via `getNow` for tests). `unitPrice` = the per-cycle price **with frequency discount baked in** (so future MIT charges use the same price without re-calculating). `originalOrderId` points at this checkout's order. No `default_card_id` yet — that field is populated by a later plan when we wire the payment methods endpoint.

**Recurring consent gate.** If any item has `subscription`, the handler rejects with `validation_failed` + `details: {reason: "recurring_consent_required"}` when `recurringConsent !== true`. The frontend enforces the checkbox; the backend re-verifies.

**Shipping.** Flat per market (`market.shippingFlat`). The `shipping` field on the quote equals this value. `GET /shipping/quote` is a separate plan.

**Known caveat — `gateway_error` (502) double-charge risk.** If the gateway throws (network blip, 5xx), we don't know whether the charge went through. A client that retries with the same `Idempotency-Key` will *not* hit our replay path (no row was persisted) and will charge again. Standard industry behavior — 502 means "unknown state, reconcile via webhook". Mitigation (pre-reserve the key before calling the gateway) is a follow-up if data shows this is a real issue.

---

## Testing Strategy

| Layer | File | Covers |
|---|---|---|
| Unit | `packages/…` (none new here) | Pricing engine + markets + catalog already covered. |
| Unit | `apps/api/test/lib/payment-gateway.test.ts` | Stub factory: `defaultOutcome`, `outcomeByToken` override, `throw` behavior. |
| Unit | `apps/api/test/services/create-order.test.ts` | Pure builder: mixed cart → correct order/items/sub/redemption shapes; no discount → no redemption; no sub lines → no subscriptions; `nextBillingDate = getNow() + interval` exact. |
| Integration | `apps/api/test/repos/orders.test.ts` | `persistOrder` atomicity: a forced error mid-transaction rolls everything back (assert 0 rows in every affected table). |
| Integration | `apps/api/test/routes/checkout.test.ts` | End-to-end with stub gateway + real DB. |

### Route-level test matrix (minimum)

1. 401 without Clerk header.
2. 400 without `Idempotency-Key`.
3. 400 when Zod body invalid (missing items).
4. 400 when cart has a subscription line but `recurringConsent` is false/missing.
5. 400 when `discountCode` is invalid (`below_minimum` path is enough — validator tested elsewhere).
6. 402 `payment_declined` when stub returns declined — verify DB: 0 `orders`, 0 `subscriptions`, 0 `discount_redemptions`, `discount_codes.times_used` unchanged.
7. 502 `gateway_error` when stub throws.
8. 201 happy path, one-time only: verify `order` + `order_items` in DB, `quote.total` matches charge.
9. 201 happy path, subscription only: verify `subscription` row with correct `nextBillingDate`, `unitPrice = getSubscriptionPrice(...)`.
10. 201 happy path, mixed cart + discount: verify all four tables written, `discount_codes.times_used` incremented by 1.
11. Idempotent replay: two identical requests with the same `Idempotency-Key` → second returns 200 with the same `orderId`, DB still has exactly one order. Charge called exactly once.
12. Discount burn prevention: stub declines, same `Idempotency-Key` retried with new token succeeds — verify `times_used` is 1 (not 2), only one redemption exists.

### Fixtures

The stub gateway is deterministic per `outcomeByToken`. Test fixtures use `tok_ok_*`, `tok_declined_*`, `tok_throw_*` naming so test intent reads at a glance.

---

## Out-of-Scope Follow-ups

Each of these is a separate brainstorming cycle + spec + plan:

1. **Payment gateway adapter** (Openpay / MercadoPago / Stripe). Concrete `PaymentGateway` implementation, HTTP client, error mapping, env-based credentials, smoke test.
2. **`GET /shipping/quote` (Envia MX)**. Pass `shippingOverride` to `calculateQuote` instead of `market.shippingFlat`.
3. **Transactional emails** via Resend. Listeners on `order.paid` + `subscription.created` events; React Email templates.
4. **Webhook handlers** (`/webhooks/openpay`, etc.). Reconcile order/subscription state from gateway events (refunds, chargebacks).
5. **Subscription lifecycle endpoints** (`pause`, `resume`, `cancel`, `frequency`) under `/me/subscriptions/*`.
6. **Daily billing job** (`processDailySubscriptions`) with dunning schedule +1 / +3 / +7.
7. **Commission calculation** on `discount_redemptions` when the code is an influencer code.
8. **Guest checkout** (email-only customer lookup). Only if conversion data demands it.
9. **Default payment method management** (`/me/payment-methods` + `default_card_id` on `subscriptions`).
