# Novapatch v2 — Backend Rebuild Design

**Date:** 2026-04-23
**Status:** Draft (pending user review)
**Author:** Diego Lucca (with Claude)

## Context

The current Novapatch backend runs on Medusa.js v2. For a subscription e-commerce catalog capped at ~20 SKUs (vitamin patches) with relatively simple domain logic, Medusa's abstractions (modules, links, workflows, DI container, admin UI) add friction without proportional value. The goal is to rebuild the backend from scratch using a lightweight stack the developer fully owns and understands, while preserving all existing integrations (Clerk, Openpay, MercadoPago, Resend, Envia, PostHog, Sentry) and feature parity (subscriptions, multi-market, discounts, influencer codes, admin operations).

## Goals

1. Replace Medusa with a minimal TypeScript stack that the developer can reason about end-to-end.
2. Preserve all existing external integrations without lock-in to any framework.
3. Keep feature parity: subscriptions with pause/resume/cancel/frequency, discount codes, influencer codes, multi-market (MX first, LATAM next), daily billing jobs, transactional emails, shipping label generation, admin operations.
4. Use TDD from day one — every module starts with a failing test.
5. Deploy as a monorepo on Railway (same platform as today).

## Non-Goals

- Multi-variant products (color/size) — 20 vitamin-patch SKUs don't need it.
- Self-service product management UI — the catalog is code, edited via PR.
- Migration of existing production data — this is a greenfield rebuild. If/when it goes live, a data migration plan will be scoped separately.
- Plugin system or third-party extensibility — the codebase is owned end-to-end.

## Stack

| Layer | Choice | Rationale |
|------|--------|-----------|
| Runtime | Bun 1.x | Fast startup, built-in cron/test/bundler, native TS |
| HTTP framework | Hono | ~14KB, middleware, typed routing |
| ORM | Drizzle | SQL-first, type-safe, no runtime magic |
| Database | PostgreSQL | Unchanged from current |
| Validation | Zod | Runtime validation + inferred types |
| Auth | `@clerk/backend` | Already used; JWT verification middleware |
| Payments (MX) | Openpay REST | Direct HTTP, no plugin layer |
| Payments (LATAM) | MercadoPago REST | Direct HTTP |
| Email | Resend SDK + React Email | Unchanged from current |
| Shipping | Envia REST | Direct HTTP client |
| Error tracking | `@sentry/node` | Hono middleware available |
| Analytics | `posthog-node` | Server-side event tracking |
| Jobs | `Bun.cron()` | Built-in, no Redis required |
| Package manager | pnpm workspaces | Monorepo management |
| Testing | `bun:test` + Playwright | Unit/integration/E2E |

## Repository Structure

```
novapatchv2/
├── apps/
│   ├── web/          # Next.js 15 (storefront + admin pages)
│   └── api/          # Hono + Bun backend
├── packages/
│   ├── catalog/      # 20 SKUs as static TypeScript data
│   ├── types/        # Shared types (Order, Subscription, Market, etc.)
│   └── markets/      # Market config (currency, tax rate, payment provider)
├── docs/
│   └── superpowers/
│       ├── specs/    # Design docs (this file)
│       └── plans/    # Implementation plans
├── pnpm-workspace.yaml
└── package.json
```

**Shared packages rationale:** product types, market config, and catalog data are consumed by both `web` and `api`. Monorepo eliminates duplication and keeps them in lockstep.

## Data Model

Five core tables plus two for discounts/influencers. Schema favors snapshots over FKs to product/pricing data (the catalog is code, not a table).

### `customers`
Links Clerk users to payment provider vaults.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| clerk_user_id | text UNIQUE | from Clerk JWT |
| email | text | |
| openpay_customer_id | text NULL | MX vault ID |
| mercadopago_customer_id | text NULL | LATAM vault ID |
| default_card_token | text NULL | provider-agnostic token id |
| created_at, updated_at | timestamp | |

### `orders`
One row per completed checkout (one-time or first cycle of a subscription).

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| customer_id | uuid FK | |
| market | text | `mx` \| `br` \| `ar` \| `cl` \| `co` |
| currency | text | ISO 4217 |
| subtotal, tax, shipping, total | integer | cents |
| discount_amount | integer | cents, 0 if none |
| discount_code_id | uuid FK NULL | |
| influencer_id | uuid FK NULL | denormalized for fast reports |
| status | text | `pending`\|`paid`\|`fulfilled`\|`failed`\|`refunded` |
| payment_provider | text | `openpay`\|`mercadopago` |
| payment_charge_id | text | provider's charge id |
| shipping_address | jsonb | snapshot |
| envia_label_url | text NULL | |
| envia_tracking | text NULL | |
| created_at | timestamp | |

### `order_items`
Snapshot rows, no FK to product.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| order_id | uuid FK | |
| product_slug | text | `energy`, `sleep`, ... |
| name | text | snapshot |
| unit_price | integer | cents, snapshot |
| quantity | integer | |
| is_subscription | boolean | |
| interval_days | integer NULL | 30 \| 60 \| 90 |
| discount_pct | integer NULL | 20 \| 15 \| 10 (frequency discount) |

### `subscriptions`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| customer_id | uuid FK | |
| original_order_id | uuid FK | first order that created this subscription |
| product_slug | text | |
| interval_days | integer | 30 \| 60 \| 90 |
| unit_price | integer | price with frequency discount already applied |
| quantity | integer | |
| market, currency | text | |
| status | text | `active`\|`paused`\|`canceled`\|`past_due`\|`delayed_oos` |
| next_billing_date | date | |
| shipping_address | jsonb | snapshot, editable by customer |
| created_at, updated_at, canceled_at | timestamp | |

### `subscription_billings`
Audit trail for every billing attempt (success or failure).

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| subscription_id | uuid FK | |
| order_id | uuid FK NULL | created only on success |
| cycle_number | integer | 1-indexed |
| amount | integer | cents |
| status | text | `success`\|`failed`\|`oos` |
| charged_at | timestamp | |
| error_message | text NULL | |

### `influencers`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | |
| email | text UNIQUE | |
| instagram_handle | text NULL | |
| commission_pct | integer | % per attributed order |
| status | text | `active`\|`paused`\|`terminated` |
| payout_method | jsonb NULL | bank details / PayPal / etc |
| notes | text NULL | |
| created_at | timestamp | |

### `discount_codes`
Unified table for both in-house promos and influencer codes.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| code | text UNIQUE | case-insensitive |
| kind | text | `promo`\|`influencer` |
| influencer_id | uuid FK NULL | only when kind=influencer |
| discount_pct | integer | % off subtotal |
| markets | text[] | which markets it's valid in |
| applies_to | text | `all`\|`once`\|`subscription` |
| min_subtotal | integer NULL | cents |
| max_uses | integer NULL | global cap |
| max_uses_per_customer | integer NULL | per-customer cap |
| times_used | integer | counter |
| valid_from, valid_until | timestamp NULL | |
| status | text | `active`\|`disabled` |
| created_at, updated_at | timestamp | |

### `discount_redemptions`
Attribution, commission calculation, and anti-abuse enforcement.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| discount_code_id | uuid FK | |
| order_id | uuid FK | |
| customer_id | uuid FK | |
| influencer_id | uuid FK NULL | denormalized |
| discount_amount | integer | cents (snapshot) |
| commission_amount | integer NULL | commission owed to influencer |
| created_at | timestamp | |

**Subscription + discount interaction:** when a code with `applies_to='subscription'` is applied at checkout, the discount is baked into the `unit_price` of the created subscription. This makes recurring cycles respect the discount without needing to re-validate the code every billing cycle.

## HTTP API

Base URL: `https://api.novapatchv2.app` (or `localhost:9000` in dev).

### Public (no auth)

```
GET    /catalog                    → products for current market with resolved prices
GET    /catalog/:slug              → single product detail
POST   /discounts/validate         → validate code, return applicable discount
GET    /shipping/quote             → ETA + cost for an MX address
POST   /checkout                   → create order (one-time or subscription) + charge
POST   /webhooks/openpay           → Openpay charge updates
POST   /webhooks/mercadopago       → MercadoPago charge updates
POST   /webhooks/envia             → Envia tracking / delivery updates
GET    /health                     → liveness probe
```

### Protected — Clerk JWT (`/me/*`)

```
GET    /me/orders                         → customer's order history
GET    /me/subscriptions                  → customer's subscriptions
POST   /me/subscriptions/:id/pause
POST   /me/subscriptions/:id/resume
POST   /me/subscriptions/:id/cancel
POST   /me/subscriptions/:id/frequency    → update interval_days
GET    /me/payment-methods                → tokens in vault
POST   /me/payment-methods/default        → set default card
```

### Admin — Clerk JWT + role check (`/admin/*`)

```
GET    /admin/orders                               → paginated with filters
GET    /admin/subscriptions                        → paginated with filters
GET    /admin/subscriptions/export                 → CSV
POST   /admin/subscriptions/:id/trigger-billing    → manual charge
GET    /admin/influencers                          → CRUD
POST   /admin/influencers
PATCH  /admin/influencers/:id
GET    /admin/discount-codes                       → CRUD
POST   /admin/discount-codes
PATCH  /admin/discount-codes/:id
GET    /admin/influencers/:id/commissions          → pending payouts
```

## Checkout Flow

The only endpoint with non-trivial orchestration. Lives in `POST /checkout`.

```
1. Validate body with Zod (items, shipping_address, payment_token, discount_code?, market)
2. Verify every item exists in the static catalog
3. Recompute subtotal/tax/shipping/total on the server (never trust frontend)
4. If discount_code provided:
   - Verify active, not expired, market applies
   - Verify max_uses and max_uses_per_customer (query discount_redemptions)
   - Verify min_subtotal threshold
5. Resolve payment provider from market (mx → openpay, others → mercadopago)
6. BEGIN TRANSACTION
   a. Upsert customer by clerk_user_id (or email for guest)
   b. Insert order with status='pending'
   c. Insert order_items
   d. If discount_code: insert discount_redemption + increment times_used
7. COMMIT
8. Charge payment gateway with token
   - Failure: UPDATE order SET status='failed'; return 402 to frontend
   - Success:
     a. UPDATE order SET status='paid', payment_charge_id
     b. For each subscription item: insert subscription (unit_price already includes discount)
     c. Fire-and-forget: confirmation email via Resend
     d. Fire-and-forget: Envia label generation
9. Return order to frontend
```

**Compensation model:** no distributed transaction is needed. If step 8 fails after the DB commit, the order sits in `status='failed'` — no partial state, no inconsistency. The customer retries and creates a new order. Side-effects (email, Envia) are fired asynchronously after the response; failures surface in Sentry and are retriable from the admin.

## Background Jobs

Scheduled via `Bun.cron()` — no Redis required.

### `processDailyBilling` — daily at 09:00 CDMX

```
SELECT subscriptions WHERE status='active' AND next_billing_date <= today

For each:
  - Check stock in catalog (if is_stockable flag on SKU)
    - OOS → status='delayed_oos', continue
  - Charge payment provider using customer's default_card_token
    - Success:
      - Insert order + order_items (snapshot of subscription data)
      - Insert subscription_billing(status='success', order_id=new)
      - Advance subscriptions.next_billing_date by interval_days
      - Fire renewal email
      - Fire Envia label workflow
    - Failure:
      - Insert subscription_billing(status='failed', error_message)
      - Update subscription.status='past_due'
      - Fire payment-failed email
  - Log summary to Slack at end
```

**Idempotency:** the query filters by `next_billing_date <= today`. On success, the date is advanced. If the job runs twice the same day, the second run finds no matching rows.

### `sendUpcomingChargeReminders` — daily at 14:00 CDMX

```
SELECT subscriptions WHERE status='active' AND next_billing_date = today + 3 days
Send reminder email via Resend
```

## Market Resolution

Markets are config, not a table.

```typescript
// packages/markets/src/index.ts
export const MARKETS = {
  mx: { currency: "MXN", paymentProvider: "openpay", taxRate: 0.16, shippingFlat: 8500 },
  br: { currency: "BRL", paymentProvider: "mercadopago", taxRate: 0.17, shippingFlat: 2500 },
  // ...
}
```

Requests carry a market identifier (from the frontend's locale prefix). A Hono middleware parses it, validates it, and attaches the resolved market config to the request context. Every downstream handler has `c.var.market` available and type-safe.

## Catalog as Code

```typescript
// packages/catalog/src/products.ts
export const PRODUCTS = {
  energy: {
    slug: "energy",
    name: "Energy Patch",
    description: "...",
    images: ["/products/energy-1.webp"],
    basePrice: { mx: 45000, br: 8900, ar: 1200000 }, // cents
    is_stockable: true,
    subscription_discounts: { 30: 20, 60: 15, 90: 10 }, // % off
  },
  // ...20 SKUs
} as const;
```

Changing a price requires a PR, review, and deploy. For 20 SKUs curated by the founder, this is a feature, not a bug — every price change is auditable in git history, and there is no CMS surface to secure.

## Admin Surface

Admin lives in the Next.js `web` app under protected `/admin/*` routes, consuming the backend's `/admin/*` API. Clerk roles (role `admin`) gate access. This removes the need for a separate admin build (Medusa's admin UI) and consolidates to a single frontend deploy.

## Testing Strategy

TDD is required from the first module.

| Level | Tool | Scope |
|---|---|---|
| Unit | `bun:test` | Pure logic: pricing, discount validation, market resolver, Zod schemas |
| Integration | `bun:test` + Postgres (test DB or Testcontainers) | Routes end-to-end, real DB, mocked external gateways |
| Contract | `bun:test` | `packages/types` validated against Zod schemas in `apps/api` |
| E2E | Playwright | Critical flows: one-time checkout, subscription checkout, pause subscription |

### External gateway mocks

`apps/api/src/test/fixtures/gateways/` provides deterministic stubs for Openpay, MercadoPago, Envia, and Resend. Each stub exposes success/declined/timeout variants selectable per test.

### Implementation order (TDD cycle per step)

1. `packages/markets` + `packages/catalog` — pure data with pricing-resolution tests
2. `apps/api` bootstrap — Hono + `/health` + Clerk middleware
3. Drizzle schema + migrations
4. `GET /catalog` — trivial endpoint to validate stack
5. Pricing engine — function pure, exhaustive tests (tax, shipping, frequency discount, promo code, combinations)
6. `POST /discounts/validate`
7. `POST /checkout` — one-time purchase (no subscription yet)
8. `POST /checkout` — subscription variant
9. `/me/subscriptions/*` endpoints
10. Daily billing job + reminder job
11. Webhooks (Openpay, MercadoPago, Envia)
12. Admin endpoints (orders, subscriptions, influencers, discount codes)
13. Frontend migration: point `novafrontend` at new API, consolidate into `apps/web`

Each step: failing tests first, then minimal code to green, then refactor.

## Open Questions

None blocking. Further details (influencer dashboard for self-service stats, tracking links for attribution beyond codes, refund flow specifics) can be scoped once the foundation is in place.

## Success Criteria

- Feature parity with the current Medusa backend across subscriptions, checkout, discounts, influencers, and admin.
- All tests (unit, integration, E2E for critical flows) pass in CI.
- Deployment on Railway with the same observability (Sentry, PostHog) wired up.
- Frontend `novafrontend` consolidated into `apps/web` and pointed at the new API.
- Codebase owned end-to-end: no framework abstraction the developer cannot read through in an afternoon.
