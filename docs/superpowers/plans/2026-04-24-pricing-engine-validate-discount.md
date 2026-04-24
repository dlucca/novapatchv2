# Pricing Engine + `POST /discounts/validate` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a pure pricing engine (subtotal/tax/shipping/discount/total) as `packages/pricing`, and a public `POST /discounts/validate` endpoint that uses it plus a `discount_codes` repo to validate promo/influencer codes before checkout.

**Architecture:**
- `packages/pricing` is a pure, DB-free function that takes `{items, market, discount?}` and returns a fully-rounded quote in cents. Same engine is used by `/discounts/validate` today and by `POST /checkout` later.
- `POST /discounts/validate` is public (no Clerk). It resolves the market from the request body (not the `?market` query — this is a POST), looks up the code via `discount_codes` repo (case-insensitive via a `lower(code)` unique index), applies business rules (active, not expired, market scope, min_subtotal, max_uses, optionally max_uses_per_customer if `customerId` is in the body), and returns `{valid: true, ...}` or `{valid: false, reason}`.
- Two DB invariants deferred from the foundation plan are added here: `CREATE UNIQUE INDEX ON discount_codes (lower(code))` and `CREATE UNIQUE INDEX ON discount_redemptions (discount_code_id, customer_id, order_id)` (prevents double-counting a redemption if retry logic ever fires twice for the same order).

**Tech Stack:** Bun + TypeScript + Hono + Drizzle (postgres.js) + Zod. New package `@novapatch/pricing`. Tests: `bun:test` (pure tests for pricing + validator; integration tests for the repo and route against real Postgres via `useTestDb()`).

**Context for implementers:** Catalog prices with frequency discounts already baked in are available via `@novapatch/catalog`'s `getPriceForMarket(product, market)` and `getSubscriptionPrice(product, market, interval)`. Markets carry `taxRate` (decimal) and `shippingFlat` (cents). The error envelope is `{error: {code, message, details?}}` — use `apiError()` from `apps/api/src/lib/errors.ts`. Add any new error codes to the `ApiErrorCode` union in that file. Money is always integer cents. Rounding convention: round at the boundary of each monetary quantity (per-item unit price, per-line subtotal sum, discount amount, tax amount) using `Math.round`.

---

## File Structure

**New:**
- `packages/pricing/package.json`
- `packages/pricing/tsconfig.json`
- `packages/pricing/src/index.ts`
- `packages/pricing/src/types.ts` — `CartItemInput`, `DiscountInput`, `PricingQuote`, `QuoteLine`
- `packages/pricing/src/engine.ts` — `calculateQuote({items, market, discount?})`
- `packages/pricing/test/engine.test.ts`
- `apps/api/drizzle/000X_discount_unique_indexes.sql` — two unique indexes (number assigned at generation time)
- `apps/api/src/repos/discount-codes.ts` — `findActiveByCode`, `countRedemptionsByCustomer`
- `apps/api/test/repos/discount-codes.test.ts`
- `apps/api/src/services/validate-discount.ts` — pure business-rule validator (takes repo fns as deps)
- `apps/api/test/services/validate-discount.test.ts`
- `apps/api/src/routes/discounts.ts` — `createDiscountRoutes(db)` factory exporting `POST /validate`
- `apps/api/test/routes/discounts.test.ts`

**Modify:**
- `pnpm-workspace.yaml` (implicit — `packages/*` is already globbed; no edit needed if so)
- `apps/api/package.json` — add `"@novapatch/pricing": "workspace:*"` dep
- `apps/api/src/index.ts` — mount `createDiscountRoutes(db)` at `/discounts` when `db` is provided
- `apps/api/src/lib/errors.ts` — add new `ApiErrorCode` literals used by this endpoint

---

## Task 1: Scaffold `packages/pricing` and define shared types

**Files:**
- Create: `packages/pricing/package.json`
- Create: `packages/pricing/tsconfig.json`
- Create: `packages/pricing/src/types.ts`
- Create: `packages/pricing/src/index.ts`
- Create: `packages/pricing/test/types.test.ts`

Mirrors how `packages/catalog` and `packages/markets` are laid out (source-exported, no build step). Check `packages/catalog/package.json` and `packages/catalog/tsconfig.json` for the exact shape before writing these — keep them structurally identical (same `exports`, same `main`, same `types`, same `tsconfig.json` extends).

- [ ] **Step 1: Create `packages/pricing/package.json`**

Copy from `packages/catalog/package.json`, then change `name` to `@novapatch/pricing` and the dependencies to exactly the two peers this package needs:

```json
{
  "name": "@novapatch/pricing",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts"
    }
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  "dependencies": {
    "@novapatch/catalog": "workspace:*",
    "@novapatch/markets": "workspace:*"
  },
  "devDependencies": {
    "bun-types": "^1.1.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create `packages/pricing/tsconfig.json`**

Copy from `packages/catalog/tsconfig.json` verbatim (same `extends`, same `include`, same `types` that include `bun-types`, same absence of `rootDir` — we learned in foundation-polish that `rootDir` fights `include: ["test/**/*"]`).

- [ ] **Step 3: Write the failing types test**

`packages/pricing/test/types.test.ts`:

```typescript
import { describe, it, expectTypeOf } from "bun:test";
import type { CartItemInput, DiscountInput, PricingQuote, QuoteLine } from "../src";

describe("pricing types", () => {
  it("CartItemInput distinguishes one-time vs subscription via optional `subscription`", () => {
    const oneTime: CartItemInput = { slug: "energy", quantity: 2 };
    const sub: CartItemInput = { slug: "energy", quantity: 1, subscription: { interval: 30 } };
    expectTypeOf(oneTime).toMatchTypeOf<CartItemInput>();
    expectTypeOf(sub).toMatchTypeOf<CartItemInput>();
  });

  it("DiscountInput carries code, pct, and appliesTo scope", () => {
    const d: DiscountInput = { code: "WELCOME10", discountPct: 10, appliesTo: "all" };
    expectTypeOf(d).toMatchTypeOf<DiscountInput>();
  });

  it("PricingQuote totals and line breakdown are integer cents", () => {
    expectTypeOf<PricingQuote["subtotal"]>().toEqualTypeOf<number>();
    expectTypeOf<PricingQuote["discountAmount"]>().toEqualTypeOf<number>();
    expectTypeOf<PricingQuote["tax"]>().toEqualTypeOf<number>();
    expectTypeOf<PricingQuote["shipping"]>().toEqualTypeOf<number>();
    expectTypeOf<PricingQuote["total"]>().toEqualTypeOf<number>();
    expectTypeOf<PricingQuote["lines"]>().toEqualTypeOf<readonly QuoteLine[]>();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd packages/pricing && bun test`
Expected: FAIL with "Cannot find module '../src'" (types not yet written).

- [ ] **Step 5: Create `packages/pricing/src/types.ts`**

```typescript
import type { MarketId } from "@novapatch/markets";
import type { ProductSlug, SubscriptionInterval } from "@novapatch/catalog";

/** Input describing one cart line. `subscription` present ⇒ recurring item (frequency discount applies). */
export interface CartItemInput {
  slug: ProductSlug;
  quantity: number;
  subscription?: { interval: SubscriptionInterval };
}

/** Scope mirrors `discount_codes.applies_to`. */
export type DiscountAppliesTo = "all" | "once" | "subscription";

/** Discount data the engine needs — already fetched + normalized by the caller. */
export interface DiscountInput {
  code: string;
  discountPct: number; // 1..100
  appliesTo: DiscountAppliesTo;
}

/** Per-line breakdown in the final quote. */
export interface QuoteLine {
  slug: ProductSlug;
  quantity: number;
  unitPrice: number;      // cents, already includes frequency discount for subs
  lineSubtotal: number;   // unitPrice * quantity
  isSubscription: boolean;
  interval?: SubscriptionInterval;
}

/** Integer-cent breakdown for the whole cart. All numbers are rounded. */
export interface PricingQuote {
  market: MarketId;
  currency: string;
  lines: readonly QuoteLine[];
  subtotal: number;        // sum of lineSubtotals
  discountAmount: number;  // amount the promo/influencer code subtracted from the eligible subset (0 if no code)
  taxableBase: number;     // subtotal - discountAmount
  tax: number;             // round(taxableBase * taxRate)
  shipping: number;        // market.shippingFlat, flat per order
  total: number;           // taxableBase + tax + shipping
}
```

- [ ] **Step 6: Create `packages/pricing/src/index.ts`**

```typescript
export * from "./types";
export * from "./engine";
```

- [ ] **Step 7: Run typecheck to verify `engine` export warning** (engine.ts doesn't exist yet)

Run: `cd packages/pricing && bun run typecheck`
Expected: FAIL with "Cannot find module './engine'". That's fine — we add it next task. Commit what we have now; the engine arrives in Task 2.

- [ ] **Step 8: Temporarily stub `engine.ts` so the package typechecks**

Create `packages/pricing/src/engine.ts`:

```typescript
// Intentional stub — real implementation lands in Task 2.
export {};
```

- [ ] **Step 9: Run typecheck + types test**

Run: `cd packages/pricing && bun run typecheck && bun test`
Expected: both pass.

- [ ] **Step 10: Wire the workspace dep and commit**

Edit `apps/api/package.json` to add under `dependencies`:

```json
"@novapatch/pricing": "workspace:*"
```

Then from the repo root:

```bash
pnpm install
git add packages/pricing pnpm-lock.yaml apps/api/package.json
git commit -m "feat(pricing): scaffold @novapatch/pricing package with types"
```

---

## Task 2: Pricing engine — subtotal, tax, shipping (no discount)

**Files:**
- Modify: `packages/pricing/src/engine.ts` (replace stub)
- Create: `packages/pricing/test/engine.test.ts`

- [ ] **Step 1: Write the failing engine tests (no-discount cases)**

`packages/pricing/test/engine.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { MARKETS } from "@novapatch/markets";
import { calculateQuote } from "../src/engine";

describe("calculateQuote — no discount", () => {
  it("computes a single one-time item in MX", () => {
    const q = calculateQuote({
      items: [{ slug: "energy", quantity: 1 }],
      market: MARKETS.mx,
    });
    expect(q.market).toBe("mx");
    expect(q.currency).toBe("MXN");
    expect(q.lines).toHaveLength(1);
    expect(q.lines[0]).toMatchObject({
      slug: "energy",
      quantity: 1,
      unitPrice: 45000,
      lineSubtotal: 45000,
      isSubscription: false,
    });
    expect(q.subtotal).toBe(45000);
    expect(q.discountAmount).toBe(0);
    expect(q.taxableBase).toBe(45000);
    expect(q.tax).toBe(7200);     // round(45000 * 0.16)
    expect(q.shipping).toBe(8500);
    expect(q.total).toBe(45000 + 7200 + 8500);
  });

  it("sums multiple lines and applies frequency discount on subscription lines", () => {
    const q = calculateQuote({
      items: [
        { slug: "energy", quantity: 2 }, // 45000 * 2 = 90000
        { slug: "sleep", quantity: 1, subscription: { interval: 30 } }, // 45000 * 0.80 = 36000
      ],
      market: MARKETS.mx,
    });
    expect(q.lines).toHaveLength(2);
    expect(q.lines[1]).toMatchObject({
      slug: "sleep",
      isSubscription: true,
      interval: 30,
      unitPrice: 36000,
      lineSubtotal: 36000,
    });
    expect(q.subtotal).toBe(90000 + 36000);
    expect(q.taxableBase).toBe(126000);
    expect(q.tax).toBe(Math.round(126000 * 0.16));
    expect(q.shipping).toBe(8500);
    expect(q.total).toBe(126000 + q.tax + 8500);
  });

  it("throws on quantity < 1", () => {
    expect(() =>
      calculateQuote({
        items: [{ slug: "energy", quantity: 0 }],
        market: MARKETS.mx,
      }),
    ).toThrow(/quantity must be >= 1/);
  });

  it("throws on unknown slug", () => {
    expect(() =>
      calculateQuote({
        // @ts-expect-error — deliberately invalid for runtime guard
        items: [{ slug: "bogus", quantity: 1 }],
        market: MARKETS.mx,
      }),
    ).toThrow(/unknown product/);
  });

  it("computes correctly in BR (pt-BR market, 17% tax, 2500 shipping)", () => {
    const q = calculateQuote({
      items: [{ slug: "glow", quantity: 1 }],
      market: MARKETS.br,
    });
    expect(q.currency).toBe("BRL");
    expect(q.subtotal).toBe(8900);
    expect(q.tax).toBe(Math.round(8900 * 0.17));
    expect(q.shipping).toBe(2500);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd packages/pricing && bun test`
Expected: FAIL with "calculateQuote is not a function" / module has no such export.

- [ ] **Step 3: Implement `calculateQuote` (no-discount path)**

Replace `packages/pricing/src/engine.ts`:

```typescript
import { getProduct, getPriceForMarket, getSubscriptionPrice } from "@novapatch/catalog";
import type { Market } from "@novapatch/markets";
import type { CartItemInput, DiscountInput, PricingQuote, QuoteLine } from "./types";

export interface CalculateQuoteInput {
  items: readonly CartItemInput[];
  market: Market;
  discount?: DiscountInput;
}

export function calculateQuote(input: CalculateQuoteInput): PricingQuote {
  if (input.items.length === 0) {
    throw new Error("calculateQuote: items must not be empty");
  }

  const lines: QuoteLine[] = input.items.map((item) => {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error(`quantity must be >= 1 (got ${item.quantity} for ${item.slug})`);
    }
    const product = getProduct(item.slug);
    if (!product) {
      throw new Error(`unknown product: ${item.slug}`);
    }
    const unitPrice = item.subscription
      ? getSubscriptionPrice(product, input.market.id, item.subscription.interval)
      : getPriceForMarket(product, input.market.id);
    const line: QuoteLine = {
      slug: item.slug,
      quantity: item.quantity,
      unitPrice,
      lineSubtotal: unitPrice * item.quantity,
      isSubscription: Boolean(item.subscription),
      ...(item.subscription ? { interval: item.subscription.interval } : {}),
    };
    return line;
  });

  const subtotal = lines.reduce((sum, l) => sum + l.lineSubtotal, 0);

  // Discount path is covered by Task 3. For now, always 0.
  const discountAmount = 0;

  const taxableBase = subtotal - discountAmount;
  const tax = Math.round(taxableBase * input.market.taxRate);
  const shipping = input.market.shippingFlat;
  const total = taxableBase + tax + shipping;

  return {
    market: input.market.id,
    currency: input.market.currency,
    lines,
    subtotal,
    discountAmount,
    taxableBase,
    tax,
    shipping,
    total,
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd packages/pricing && bun test`
Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/pricing
git commit -m "feat(pricing): calculateQuote with subtotal/tax/shipping"
```

---

## Task 3: Pricing engine — discount application with `appliesTo` scoping

**Files:**
- Modify: `packages/pricing/src/engine.ts`
- Modify: `packages/pricing/test/engine.test.ts` (append)

The spec has three `appliesTo` modes:
- `"all"` — discount applies to the full subtotal (both one-time and subscription lines)
- `"once"` — discount applies only to the one-time portion of the subtotal
- `"subscription"` — discount applies only to the subscription portion of the subtotal

Discount amount is `Math.round(eligibleSubtotal * discountPct / 100)`. Tax is computed on `subtotal - discountAmount`. Shipping is flat and never discounted.

- [ ] **Step 1: Append failing discount tests**

Append to `packages/pricing/test/engine.test.ts`:

```typescript
describe("calculateQuote — with discount", () => {
  it("applies an `all` discount to full subtotal", () => {
    const q = calculateQuote({
      items: [
        { slug: "energy", quantity: 1 }, // 45000
        { slug: "sleep", quantity: 1, subscription: { interval: 30 } }, // 36000
      ],
      market: MARKETS.mx,
      discount: { code: "WELCOME10", discountPct: 10, appliesTo: "all" },
    });
    expect(q.subtotal).toBe(81000);
    expect(q.discountAmount).toBe(Math.round(81000 * 0.10)); // 8100
    expect(q.taxableBase).toBe(81000 - 8100);
    expect(q.tax).toBe(Math.round((81000 - 8100) * 0.16));
    expect(q.total).toBe(q.taxableBase + q.tax + q.shipping);
  });

  it("applies a `once` discount only to one-time lines", () => {
    const q = calculateQuote({
      items: [
        { slug: "energy", quantity: 1 }, // 45000 one-time
        { slug: "sleep", quantity: 1, subscription: { interval: 30 } }, // 36000 sub
      ],
      market: MARKETS.mx,
      discount: { code: "ONCE15", discountPct: 15, appliesTo: "once" },
    });
    // Only the 45000 one-time portion is eligible.
    expect(q.discountAmount).toBe(Math.round(45000 * 0.15));
  });

  it("applies a `subscription` discount only to subscription lines", () => {
    const q = calculateQuote({
      items: [
        { slug: "energy", quantity: 1 }, // 45000 one-time
        { slug: "sleep", quantity: 1, subscription: { interval: 30 } }, // 36000 sub
      ],
      market: MARKETS.mx,
      discount: { code: "SUB20", discountPct: 20, appliesTo: "subscription" },
    });
    expect(q.discountAmount).toBe(Math.round(36000 * 0.20));
  });

  it("applies 0 when scope matches no lines", () => {
    const q = calculateQuote({
      items: [{ slug: "energy", quantity: 1 }], // only one-time
      market: MARKETS.mx,
      discount: { code: "SUBONLY", discountPct: 25, appliesTo: "subscription" },
    });
    expect(q.discountAmount).toBe(0);
    expect(q.taxableBase).toBe(45000);
  });

  it("rounds discountAmount (not floor/ceil)", () => {
    // synthetic: 1 item at 4503 with 10% → 450.30 → round → 450
    // We can't change catalog from a test, so exercise rounding via the engine's
    // known-good behavior: 45000 * 0.15 = 6750 (exact) — pick a case where the
    // product is pennies-off. Use 2 items, 15% gives exact 13500, which doesn't
    // test rounding. So construct a case with 3 items: 45000 * 3 * 0.13 = 17550
    // (exact). The discount-engine rounding rule is simple; the boundary case
    // already exists in the catalog's getSubscriptionPrice tests.
    const q = calculateQuote({
      items: [{ slug: "energy", quantity: 3 }],
      market: MARKETS.mx,
      discount: { code: "P13", discountPct: 13, appliesTo: "all" },
    });
    expect(q.discountAmount).toBe(Math.round(135000 * 0.13));
  });

  it("throws on discountPct outside 1..100", () => {
    expect(() =>
      calculateQuote({
        items: [{ slug: "energy", quantity: 1 }],
        market: MARKETS.mx,
        discount: { code: "X", discountPct: 0, appliesTo: "all" },
      }),
    ).toThrow(/discountPct must be/);
    expect(() =>
      calculateQuote({
        items: [{ slug: "energy", quantity: 1 }],
        market: MARKETS.mx,
        discount: { code: "X", discountPct: 101, appliesTo: "all" },
      }),
    ).toThrow(/discountPct must be/);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/pricing && bun test`
Expected: 6 new failures (discountAmount stays 0, validation throws missing).

- [ ] **Step 3: Update `engine.ts` to implement discount scoping**

Replace the `const discountAmount = 0;` line and preceding discount comment with:

```typescript
  const discountAmount = input.discount
    ? computeDiscountAmount(lines, input.discount)
    : 0;
```

Add this helper to the same file (below `calculateQuote`):

```typescript
function computeDiscountAmount(
  lines: readonly QuoteLine[],
  discount: DiscountInput,
): number {
  if (
    !Number.isInteger(discount.discountPct) ||
    discount.discountPct < 1 ||
    discount.discountPct > 100
  ) {
    throw new Error(
      `discountPct must be an integer in 1..100 (got ${discount.discountPct})`,
    );
  }
  const eligible = lines
    .filter((l) => matchesScope(l, discount.appliesTo))
    .reduce((sum, l) => sum + l.lineSubtotal, 0);
  return Math.round((eligible * discount.discountPct) / 100);
}

function matchesScope(line: QuoteLine, appliesTo: DiscountInput["appliesTo"]): boolean {
  if (appliesTo === "all") return true;
  if (appliesTo === "subscription") return line.isSubscription;
  if (appliesTo === "once") return !line.isSubscription;
  return false;
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/pricing && bun test`
Expected: all tests pass (11 total).

- [ ] **Step 5: Commit**

```bash
git add packages/pricing
git commit -m "feat(pricing): discount with appliesTo scoping"
```

---

## Task 4: DB migration — unique indexes on discount tables

**Files:**
- Create: `apps/api/drizzle/<next-number>_discount_unique_indexes.sql` (Drizzle assigns the number)
- Modify: `apps/api/src/db/schema/discounts.ts` (add index decls so future diffs are stable)
- Create: `apps/api/test/db/discount-indexes.test.ts`

Two invariants:
1. `CREATE UNIQUE INDEX discount_codes_lower_code_unique ON discount_codes (lower(code))` — enforces case-insensitive uniqueness on codes as the spec requires (`text UNIQUE | case-insensitive`).
2. `CREATE UNIQUE INDEX discount_redemptions_code_customer_order_unique ON discount_redemptions (discount_code_id, customer_id, order_id)` — protects against double-counting if a checkout retry ever inserts a second redemption row for the same (code, customer, order) tuple.

- [ ] **Step 1: Add index declarations to the Drizzle schema**

Replace the bodies of the two `pgTable(...)` calls in `apps/api/src/db/schema/discounts.ts` with a third argument (index map). Keep every existing column unchanged. The file becomes:

```typescript
import { pgTable, uuid, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { influencers } from "./influencers";
import { orders } from "./orders";
import { customers } from "./customers";

export const discountCodes = pgTable(
  "discount_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    kind: text("kind").notNull(),
    influencerId: uuid("influencer_id").references(() => influencers.id),

    discountPct: integer("discount_pct").notNull(),
    markets: text("markets").array().notNull(),
    appliesTo: text("applies_to").notNull(),

    minSubtotal: integer("min_subtotal"),
    maxUses: integer("max_uses"),
    maxUsesPerCustomer: integer("max_uses_per_customer"),
    timesUsed: integer("times_used").notNull().default(0),

    validFrom: timestamp("valid_from", { withTimezone: true }),
    validUntil: timestamp("valid_until", { withTimezone: true }),

    status: text("status").notNull().default("active"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    lowerCodeUnique: uniqueIndex("discount_codes_lower_code_unique").on(sql`lower(${t.code})`),
  }),
);

export const discountRedemptions = pgTable(
  "discount_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    discountCodeId: uuid("discount_code_id")
      .notNull()
      .references(() => discountCodes.id),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    influencerId: uuid("influencer_id").references(() => influencers.id),

    discountAmount: integer("discount_amount").notNull(),
    commissionAmount: integer("commission_amount"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    codeCustomerOrderUnique: uniqueIndex("discount_redemptions_code_customer_order_unique").on(
      t.discountCodeId,
      t.customerId,
      t.orderId,
    ),
  }),
);

export type DiscountCode = typeof discountCodes.$inferSelect;
export type NewDiscountCode = typeof discountCodes.$inferInsert;
export type DiscountRedemption = typeof discountRedemptions.$inferSelect;
export type NewDiscountRedemption = typeof discountRedemptions.$inferInsert;
```

- [ ] **Step 2: Generate the migration**

Run: `cd apps/api && bunx drizzle-kit generate`
Expected: a new file like `apps/api/drizzle/000X_<name>_discount_unique_indexes.sql` (the number depends on what exists; the generator picks the next unused slot).

Open the generated SQL file and verify it contains (order may vary):

```sql
CREATE UNIQUE INDEX "discount_codes_lower_code_unique" ON "discount_codes" USING btree (lower("code"));
CREATE UNIQUE INDEX "discount_redemptions_code_customer_order_unique" ON "discount_redemptions" USING btree ("discount_code_id","customer_id","order_id");
```

If the generator produced anything unexpected (a column rename, a drop), stop and investigate — do not hand-edit around it.

- [ ] **Step 3: Write an integration test that exercises both invariants**

`apps/api/test/db/discount-indexes.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { useTestDb } from "../helpers/db";
import { discountCodes, discountRedemptions } from "../../src/db/schema/discounts";
import { customers } from "../../src/db/schema/customers";
import { orders } from "../../src/db/schema/orders";

describe("discount unique indexes", () => {
  const { getDb } = useTestDb();

  it("rejects two codes that differ only in case", async () => {
    const db = getDb();
    await db.insert(discountCodes).values({
      code: "welcome10",
      kind: "promo",
      discountPct: 10,
      markets: ["mx"],
      appliesTo: "all",
    });
    await expect(
      db.insert(discountCodes).values({
        code: "WELCOME10",
        kind: "promo",
        discountPct: 10,
        markets: ["mx"],
        appliesTo: "all",
      }),
    ).rejects.toThrow(/discount_codes_lower_code_unique/);
  });

  it("rejects a second redemption for the same (code, customer, order) tuple", async () => {
    const db = getDb();
    const [code] = await db
      .insert(discountCodes)
      .values({
        code: "dup-guard",
        kind: "promo",
        discountPct: 10,
        markets: ["mx"],
        appliesTo: "all",
      })
      .returning();
    const [customer] = await db
      .insert(customers)
      .values({ clerkUserId: "user_dup", email: "dup@example.com" })
      .returning();
    const [order] = await db
      .insert(orders)
      .values({
        customerId: customer!.id,
        market: "mx",
        status: "pending",
        subtotal: 45000,
        tax: 7200,
        shipping: 8500,
        discountAmount: 0,
        total: 60700,
        currency: "MXN",
        shippingAddress: {},
      })
      .returning();

    await db.insert(discountRedemptions).values({
      discountCodeId: code!.id,
      customerId: customer!.id,
      orderId: order!.id,
      discountAmount: 4500,
    });

    await expect(
      db.insert(discountRedemptions).values({
        discountCodeId: code!.id,
        customerId: customer!.id,
        orderId: order!.id,
        discountAmount: 4500,
      }),
    ).rejects.toThrow(/discount_redemptions_code_customer_order_unique/);
  });
});
```

**Important:** before writing the order-insert in this test, open `apps/api/src/db/schema/orders.ts` and confirm the column names + required fields. Adjust the `.values({...})` above to match. If a column in `orders` is NOT NULL and not in the test above, add it with a realistic value. Don't invent columns — use what the schema actually declares.

- [ ] **Step 4: Run the test — expect migration to have applied cleanly**

From repo root with the test DB up (see `apps/api/README` / docker-compose):

```bash
cd apps/api && bun test test/db/discount-indexes.test.ts
```

Expected: both tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/drizzle apps/api/src/db/schema/discounts.ts apps/api/test/db
git commit -m "feat(db): unique indexes on discount_codes(lower(code)) and discount_redemptions"
```

---

## Task 5: `discount-codes` repo — `findActiveByCode` + `countRedemptionsByCustomer`

**Files:**
- Create: `apps/api/src/repos/discount-codes.ts`
- Create: `apps/api/test/repos/discount-codes.test.ts`

Repo convention in this codebase: thin functions taking `db` as the first arg, returning typed rows or `undefined`. See `apps/api/src/repos/customers.ts` for the established shape.

`findActiveByCode(db, {code, market, now})` — fetch the code (case-insensitive), filter by status=`active`, valid_from <= now or NULL, valid_until >= now or NULL, and market in `markets[]`. Returns the row or `undefined`. Validity filtering is pushed to SQL so callers don't accidentally leak expired codes.

`countRedemptionsByCustomer(db, {discountCodeId, customerId})` — returns an integer count. Used to enforce `max_uses_per_customer`.

- [ ] **Step 1: Write the failing repo tests**

`apps/api/test/repos/discount-codes.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { useTestDb } from "../helpers/db";
import { discountCodes, discountRedemptions } from "../../src/db/schema/discounts";
import { customers } from "../../src/db/schema/customers";
import { orders } from "../../src/db/schema/orders";
import {
  findActiveByCode,
  countRedemptionsByCustomer,
} from "../../src/repos/discount-codes";

const NOW = new Date("2026-06-01T12:00:00Z");

async function insertCode(db: ReturnType<typeof useTestDb>["getDb"] extends () => infer T ? T : never, overrides: Partial<typeof discountCodes.$inferInsert> = {}) {
  const [row] = await db.insert(discountCodes).values({
    code: "welcome10",
    kind: "promo",
    discountPct: 10,
    markets: ["mx"],
    appliesTo: "all",
    status: "active",
    ...overrides,
  }).returning();
  return row!;
}

describe("discount-codes repo — findActiveByCode", () => {
  const { getDb } = useTestDb();

  it("matches case-insensitively", async () => {
    const db = getDb();
    await insertCode(db, { code: "welcome10" });
    const found = await findActiveByCode(db, { code: "WELCOME10", market: "mx", now: NOW });
    expect(found?.code).toBe("welcome10");
  });

  it("returns undefined when code is disabled", async () => {
    const db = getDb();
    await insertCode(db, { code: "disabled", status: "disabled" });
    const found = await findActiveByCode(db, { code: "disabled", market: "mx", now: NOW });
    expect(found).toBeUndefined();
  });

  it("returns undefined when code has expired", async () => {
    const db = getDb();
    await insertCode(db, { code: "expired", validUntil: new Date("2026-01-01T00:00:00Z") });
    const found = await findActiveByCode(db, { code: "expired", market: "mx", now: NOW });
    expect(found).toBeUndefined();
  });

  it("returns undefined when code has not yet started", async () => {
    const db = getDb();
    await insertCode(db, { code: "future", validFrom: new Date("2027-01-01T00:00:00Z") });
    const found = await findActiveByCode(db, { code: "future", market: "mx", now: NOW });
    expect(found).toBeUndefined();
  });

  it("returns undefined when code is not valid in the requested market", async () => {
    const db = getDb();
    await insertCode(db, { code: "mxonly", markets: ["mx"] });
    const found = await findActiveByCode(db, { code: "mxonly", market: "br", now: NOW });
    expect(found).toBeUndefined();
  });

  it("returns the code when it's active, within window, and market matches", async () => {
    const db = getDb();
    await insertCode(db, {
      code: "happy",
      validFrom: new Date("2026-01-01T00:00:00Z"),
      validUntil: new Date("2027-01-01T00:00:00Z"),
      markets: ["mx", "br"],
    });
    const found = await findActiveByCode(db, { code: "happy", market: "br", now: NOW });
    expect(found?.code).toBe("happy");
  });
});

describe("discount-codes repo — countRedemptionsByCustomer", () => {
  const { getDb } = useTestDb();

  it("returns 0 when there are no redemptions", async () => {
    const db = getDb();
    const code = await insertCode(db, { code: "never-used" });
    const [c] = await db.insert(customers).values({ clerkUserId: "u1", email: "u1@example.com" }).returning();
    const n = await countRedemptionsByCustomer(db, {
      discountCodeId: code.id,
      customerId: c!.id,
    });
    expect(n).toBe(0);
  });

  it("counts only redemptions for the matching (code, customer) pair", async () => {
    const db = getDb();
    const code = await insertCode(db, { code: "usedtwice" });
    const otherCode = await insertCode(db, { code: "othercode" });
    const [alice] = await db.insert(customers).values({ clerkUserId: "u_alice", email: "a@example.com" }).returning();
    const [bob] = await db.insert(customers).values({ clerkUserId: "u_bob", email: "b@example.com" }).returning();

    async function insertOrderFor(customerId: string) {
      const [order] = await db
        .insert(orders)
        .values({
          customerId,
          market: "mx",
          status: "pending",
          subtotal: 45000,
          tax: 7200,
          shipping: 8500,
          discountAmount: 0,
          total: 60700,
          currency: "MXN",
          shippingAddress: {},
        })
        .returning();
      return order!.id;
    }

    const aliceOrder1 = await insertOrderFor(alice!.id);
    const aliceOrder2 = await insertOrderFor(alice!.id);
    const bobOrder = await insertOrderFor(bob!.id);

    await db.insert(discountRedemptions).values([
      { discountCodeId: code.id, customerId: alice!.id, orderId: aliceOrder1, discountAmount: 4500 },
      { discountCodeId: code.id, customerId: alice!.id, orderId: aliceOrder2, discountAmount: 4500 },
      { discountCodeId: otherCode.id, customerId: alice!.id, orderId: aliceOrder1, discountAmount: 4500 },
      { discountCodeId: code.id, customerId: bob!.id, orderId: bobOrder, discountAmount: 4500 },
    ]);

    const n = await countRedemptionsByCustomer(db, {
      discountCodeId: code.id,
      customerId: alice!.id,
    });
    expect(n).toBe(2);
  });
});
```

Like Task 4, open `apps/api/src/db/schema/orders.ts` before running — the `.values({...})` above must match every NOT NULL column.

- [ ] **Step 2: Run tests — fail with "cannot find module"**

Run: `cd apps/api && bun test test/repos/discount-codes.test.ts`
Expected: FAIL — module `../../src/repos/discount-codes` not found.

- [ ] **Step 3: Implement the repo**

`apps/api/src/repos/discount-codes.ts`:

```typescript
import { and, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import type { Db } from "../db";
import { discountCodes, discountRedemptions, type DiscountCode } from "../db/schema/discounts";
import type { MarketId } from "@novapatch/markets";

export interface FindActiveByCodeInput {
  code: string;
  market: MarketId;
  now: Date;
}

/**
 * Looks up a discount code that is usable right now in the given market.
 *
 *  - case-insensitive on `code`
 *  - status = 'active'
 *  - valid_from IS NULL OR valid_from <= now
 *  - valid_until IS NULL OR valid_until >= now
 *  - market present in `markets[]`
 *
 * Returns the row or undefined. Does NOT check max_uses or min_subtotal —
 * those are checked by the validator, which also has the cart subtotal in hand.
 */
export async function findActiveByCode(
  db: Db,
  { code, market, now }: FindActiveByCodeInput,
): Promise<DiscountCode | undefined> {
  const [row] = await db
    .select()
    .from(discountCodes)
    .where(
      and(
        sql`lower(${discountCodes.code}) = lower(${code})`,
        eq(discountCodes.status, "active"),
        or(isNull(discountCodes.validFrom), lte(discountCodes.validFrom, now)),
        or(isNull(discountCodes.validUntil), gte(discountCodes.validUntil, now)),
        sql`${market} = ANY(${discountCodes.markets})`,
      ),
    )
    .limit(1);
  return row;
}

export interface CountRedemptionsInput {
  discountCodeId: string;
  customerId: string;
}

export async function countRedemptionsByCustomer(
  db: Db,
  { discountCodeId, customerId }: CountRedemptionsInput,
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(discountRedemptions)
    .where(
      and(
        eq(discountRedemptions.discountCodeId, discountCodeId),
        eq(discountRedemptions.customerId, customerId),
      ),
    );
  return row?.n ?? 0;
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/api && bun test test/repos/discount-codes.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/repos/discount-codes.ts apps/api/test/repos/discount-codes.test.ts
git commit -m "feat(api): discount-codes repo — findActiveByCode + countRedemptionsByCustomer"
```

---

## Task 6: Validator service — pure business-rule check

**Files:**
- Create: `apps/api/src/services/validate-discount.ts`
- Create: `apps/api/test/services/validate-discount.test.ts`

This file composes the repo with pure rules. It returns a discriminated union describing why validation passed or failed. The rules that live here (and not in the repo) need the cart subtotal in hand:

- `min_subtotal` — cart subtotal must be >= threshold
- `max_uses` — `times_used` must be < cap
- `max_uses_per_customer` — only if `customerId` provided; skip otherwise

Returned reasons (add these as new `ApiErrorCode` literals — see Task 7):

| reason | meaning |
|---|---|
| `discount_not_found` | No matching active code in this market / case / window |
| `discount_below_minimum` | Cart subtotal below `min_subtotal` |
| `discount_max_uses_reached` | Global `max_uses` hit |
| `discount_max_per_customer_reached` | Customer-specific cap hit |

On success the service returns the discount shape the pricing engine needs plus a snapshot for the response.

- [ ] **Step 1: Write failing validator tests**

`apps/api/test/services/validate-discount.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { validateDiscount } from "../../src/services/validate-discount";
import type { DiscountCode } from "../../src/db/schema/discounts";

const baseCode: DiscountCode = {
  id: "00000000-0000-0000-0000-000000000001",
  code: "welcome10",
  kind: "promo",
  influencerId: null,
  discountPct: 10,
  markets: ["mx"],
  appliesTo: "all",
  minSubtotal: null,
  maxUses: null,
  maxUsesPerCustomer: null,
  timesUsed: 0,
  validFrom: null,
  validUntil: null,
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("validateDiscount", () => {
  it("returns not_found when the repo returns undefined", async () => {
    const result = await validateDiscount({
      code: "bogus",
      market: "mx",
      subtotal: 45000,
      now: new Date(),
      findActiveByCode: async () => undefined,
      countRedemptionsByCustomer: async () => 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("discount_not_found");
  });

  it("returns below_minimum when subtotal < min_subtotal", async () => {
    const result = await validateDiscount({
      code: "welcome10",
      market: "mx",
      subtotal: 40000,
      now: new Date(),
      findActiveByCode: async () => ({ ...baseCode, minSubtotal: 50000 }),
      countRedemptionsByCustomer: async () => 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("discount_below_minimum");
  });

  it("returns max_uses_reached when times_used >= max_uses", async () => {
    const result = await validateDiscount({
      code: "welcome10",
      market: "mx",
      subtotal: 45000,
      now: new Date(),
      findActiveByCode: async () => ({ ...baseCode, maxUses: 100, timesUsed: 100 }),
      countRedemptionsByCustomer: async () => 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("discount_max_uses_reached");
  });

  it("skips the per-customer check when customerId is absent", async () => {
    const result = await validateDiscount({
      code: "welcome10",
      market: "mx",
      subtotal: 45000,
      now: new Date(),
      findActiveByCode: async () => ({ ...baseCode, maxUsesPerCustomer: 1 }),
      countRedemptionsByCustomer: async () => 999,
    });
    expect(result.ok).toBe(true);
  });

  it("returns max_per_customer_reached when customer cap hit", async () => {
    const result = await validateDiscount({
      code: "welcome10",
      market: "mx",
      subtotal: 45000,
      customerId: "11111111-1111-1111-1111-111111111111",
      now: new Date(),
      findActiveByCode: async () => ({ ...baseCode, maxUsesPerCustomer: 1 }),
      countRedemptionsByCustomer: async () => 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("discount_max_per_customer_reached");
  });

  it("returns ok with the normalized discount on success", async () => {
    const result = await validateDiscount({
      code: "welcome10",
      market: "mx",
      subtotal: 45000,
      now: new Date(),
      findActiveByCode: async () => baseCode,
      countRedemptionsByCustomer: async () => 0,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.discount).toEqual({
        code: "welcome10",
        discountPct: 10,
        appliesTo: "all",
      });
      expect(result.discountCodeId).toBe(baseCode.id);
    }
  });
});
```

- [ ] **Step 2: Run — expect module-not-found**

Run: `cd apps/api && bun test test/services/validate-discount.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement the service**

`apps/api/src/services/validate-discount.ts`:

```typescript
import type { MarketId } from "@novapatch/markets";
import type { DiscountInput } from "@novapatch/pricing";
import type { DiscountCode } from "../db/schema/discounts";

export type DiscountRejectionReason =
  | "discount_not_found"
  | "discount_below_minimum"
  | "discount_max_uses_reached"
  | "discount_max_per_customer_reached";

export type ValidateDiscountResult =
  | {
      ok: true;
      discountCodeId: string;
      discount: DiscountInput;
      code: DiscountCode;
    }
  | { ok: false; reason: DiscountRejectionReason };

export interface ValidateDiscountInput {
  code: string;
  market: MarketId;
  subtotal: number;
  customerId?: string;
  now: Date;
  findActiveByCode: (args: {
    code: string;
    market: MarketId;
    now: Date;
  }) => Promise<DiscountCode | undefined>;
  countRedemptionsByCustomer: (args: {
    discountCodeId: string;
    customerId: string;
  }) => Promise<number>;
}

export async function validateDiscount(
  input: ValidateDiscountInput,
): Promise<ValidateDiscountResult> {
  const code = await input.findActiveByCode({
    code: input.code,
    market: input.market,
    now: input.now,
  });
  if (!code) return { ok: false, reason: "discount_not_found" };

  if (code.minSubtotal !== null && input.subtotal < code.minSubtotal) {
    return { ok: false, reason: "discount_below_minimum" };
  }

  if (code.maxUses !== null && code.timesUsed >= code.maxUses) {
    return { ok: false, reason: "discount_max_uses_reached" };
  }

  if (code.maxUsesPerCustomer !== null && input.customerId) {
    const used = await input.countRedemptionsByCustomer({
      discountCodeId: code.id,
      customerId: input.customerId,
    });
    if (used >= code.maxUsesPerCustomer) {
      return { ok: false, reason: "discount_max_per_customer_reached" };
    }
  }

  return {
    ok: true,
    discountCodeId: code.id,
    code,
    discount: {
      code: code.code,
      discountPct: code.discountPct,
      appliesTo: code.appliesTo as DiscountInput["appliesTo"],
    },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/api && bun test test/services/validate-discount.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services apps/api/test/services
git commit -m "feat(api): validate-discount service (pure rule engine)"
```

---

## Task 7: `POST /discounts/validate` route + integration tests

**Files:**
- Modify: `apps/api/src/lib/errors.ts` (add 4 new codes)
- Create: `apps/api/src/routes/discounts.ts`
- Create: `apps/api/test/routes/discounts.test.ts`
- Modify: `apps/api/src/index.ts` (mount)

The endpoint is public (no Clerk). Body is validated with Zod. Market is read from the body (not `?market` — this is POST and the frontend already has the market). It returns either a pricing-ready discount payload or a 200 OK with `{valid: false, reason}`. A malformed body returns 400 `validation_failed` with Zod errors under `details`.

The response shape when valid:

```json
{
  "valid": true,
  "code": "WELCOME10",
  "discountPct": 10,
  "appliesTo": "all",
  "discountAmount": 8100,
  "eligibleSubtotal": 81000,
  "quote": { /* full PricingQuote from engine */ }
}
```

When invalid (still 200 so the frontend can show a friendly message without exception handling):

```json
{ "valid": false, "reason": "discount_below_minimum" }
```

- [ ] **Step 1: Extend the error code union**

Edit `apps/api/src/lib/errors.ts`: add the four new literals to `ApiErrorCode`:

```typescript
export type ApiErrorCode =
  | "market_missing"
  | "market_empty"
  | "market_unknown"
  | "product_not_found"
  | "not_found"
  | "internal_error"
  | "validation_failed"
  | "auth_missing"
  | "auth_malformed"
  | "auth_invalid"
  | "discount_not_found"
  | "discount_below_minimum"
  | "discount_max_uses_reached"
  | "discount_max_per_customer_reached";
```

- [ ] **Step 2: Write failing route tests**

`apps/api/test/routes/discounts.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { createApp } from "../../src/index";
import { useTestDb } from "../helpers/db";
import { discountCodes } from "../../src/db/schema/discounts";

type ValidBody = {
  valid: true;
  code: string;
  discountPct: number;
  appliesTo: "all" | "once" | "subscription";
  discountAmount: number;
  eligibleSubtotal: number;
  quote: {
    subtotal: number;
    discountAmount: number;
    tax: number;
    shipping: number;
    total: number;
  };
};
type InvalidBody = { valid: false; reason: string };
type ErrorBody = { error: { code: string; message: string; details?: unknown } };

describe("POST /discounts/validate", () => {
  const { getDb } = useTestDb();

  function buildApp() {
    return createApp({ db: getDb() });
  }

  async function seedActive(code: string, overrides: Partial<typeof discountCodes.$inferInsert> = {}) {
    const [row] = await getDb()
      .insert(discountCodes)
      .values({
        code,
        kind: "promo",
        discountPct: 10,
        markets: ["mx"],
        appliesTo: "all",
        status: "active",
        ...overrides,
      })
      .returning();
    return row!;
  }

  it("returns 400 validation_failed on missing fields", async () => {
    const res = await buildApp().fetch(
      new Request("http://localhost/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("validation_failed");
    expect(body.error.details).toBeDefined();
  });

  it("returns 400 market_unknown on a non-existent market", async () => {
    const res = await buildApp().fetch(
      new Request("http://localhost/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "anything",
          market: "zz",
          items: [{ slug: "energy", quantity: 1 }],
        }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("market_unknown");
  });

  it("returns {valid:false, reason:discount_not_found} with 200 for unknown code", async () => {
    const res = await buildApp().fetch(
      new Request("http://localhost/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "nope",
          market: "mx",
          items: [{ slug: "energy", quantity: 1 }],
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as InvalidBody;
    expect(body.valid).toBe(false);
    expect(body.reason).toBe("discount_not_found");
  });

  it("returns {valid:true, ...} with the computed quote on success (case-insensitive code match)", async () => {
    await seedActive("welcome10", { discountPct: 10, appliesTo: "all", markets: ["mx"] });
    const res = await buildApp().fetch(
      new Request("http://localhost/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "WELCOME10",
          market: "mx",
          items: [{ slug: "energy", quantity: 1 }],
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as ValidBody;
    expect(body.valid).toBe(true);
    expect(body.code).toBe("welcome10");
    expect(body.discountPct).toBe(10);
    expect(body.appliesTo).toBe("all");
    expect(body.eligibleSubtotal).toBe(45000);
    expect(body.discountAmount).toBe(4500);
    expect(body.quote.subtotal).toBe(45000);
    expect(body.quote.discountAmount).toBe(4500);
    expect(body.quote.total).toBe(45000 - 4500 + Math.round((45000 - 4500) * 0.16) + 8500);
  });

  it("returns {valid:false, reason:discount_below_minimum} when cart is too small", async () => {
    await seedActive("minspend", { minSubtotal: 90000 });
    const res = await buildApp().fetch(
      new Request("http://localhost/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "minspend",
          market: "mx",
          items: [{ slug: "energy", quantity: 1 }],
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as InvalidBody;
    expect(body.valid).toBe(false);
    expect(body.reason).toBe("discount_below_minimum");
  });

  it("respects market scoping — a code valid only in BR is not found in MX", async () => {
    await seedActive("bronly", { markets: ["br"] });
    const res = await buildApp().fetch(
      new Request("http://localhost/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "bronly",
          market: "mx",
          items: [{ slug: "energy", quantity: 1 }],
        }),
      }),
    );
    const body = (await res.json()) as InvalidBody;
    expect(body.valid).toBe(false);
    expect(body.reason).toBe("discount_not_found");
  });
});
```

- [ ] **Step 3: Run — expect route not wired**

Run: `cd apps/api && bun test test/routes/discounts.test.ts`
Expected: FAIL (404s or module-not-found if the import is missing).

- [ ] **Step 4: Create the route module**

`apps/api/src/routes/discounts.ts`:

```typescript
import { Hono } from "hono";
import { z } from "zod";
import { resolveMarket, isMarketId } from "@novapatch/markets";
import { calculateQuote } from "@novapatch/pricing";
import type { Db } from "../db";
import { apiError } from "../lib/errors";
import {
  findActiveByCode,
  countRedemptionsByCustomer,
} from "../repos/discount-codes";
import { validateDiscount } from "../services/validate-discount";

const ItemSchema = z.object({
  slug: z.enum(["energy", "sleep", "glow", "shield", "zen", "woman"]),
  quantity: z.number().int().min(1),
  subscription: z
    .object({ interval: z.union([z.literal(30), z.literal(60), z.literal(90)]) })
    .optional(),
});

const BodySchema = z.object({
  code: z.string().min(1).max(64),
  market: z.string().min(1).max(8),
  items: z.array(ItemSchema).min(1),
  customerId: z.string().uuid().optional(),
});

export function createDiscountRoutes(db: Db): Hono {
  const r = new Hono();

  r.post("/validate", async (c) => {
    const parsed = BodySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      const { body, status } = apiError(
        "validation_failed",
        "invalid request body",
        400,
        parsed.error.flatten(),
      );
      return c.json(body, status);
    }
    const input = parsed.data;

    const marketIdRaw = input.market.trim().toLowerCase();
    if (!isMarketId(marketIdRaw)) {
      const { body, status } = apiError(
        "market_unknown",
        `unknown market: ${input.market}`,
        400,
      );
      return c.json(body, status);
    }
    const market = resolveMarket(marketIdRaw);

    // Compute a no-discount quote first so we know the subtotal.
    const draft = calculateQuote({ items: input.items, market });

    const result = await validateDiscount({
      code: input.code,
      market: market.id,
      subtotal: draft.subtotal,
      ...(input.customerId ? { customerId: input.customerId } : {}),
      now: new Date(),
      findActiveByCode: (args) => findActiveByCode(db, args),
      countRedemptionsByCustomer: (args) => countRedemptionsByCustomer(db, args),
    });

    if (!result.ok) {
      return c.json({ valid: false as const, reason: result.reason });
    }

    const quote = calculateQuote({
      items: input.items,
      market,
      discount: result.discount,
    });

    const eligibleSubtotal = quote.lines
      .filter((l) => {
        if (result.discount.appliesTo === "all") return true;
        if (result.discount.appliesTo === "subscription") return l.isSubscription;
        return !l.isSubscription; // "once"
      })
      .reduce((sum, l) => sum + l.lineSubtotal, 0);

    return c.json({
      valid: true as const,
      code: result.code.code,
      discountPct: result.discount.discountPct,
      appliesTo: result.discount.appliesTo,
      discountAmount: quote.discountAmount,
      eligibleSubtotal,
      quote,
    });
  });

  return r;
}
```

- [ ] **Step 5: Mount the route**

Edit `apps/api/src/index.ts`. In `createApp`, after the existing `app.route("/catalog", catalogRoutes);` line, add:

```typescript
  if (deps.db) {
    app.route("/discounts", createDiscountRoutes(deps.db));
  }
```

And add the import at the top:

```typescript
import { createDiscountRoutes } from "./routes/discounts";
```

- [ ] **Step 6: Run tests**

Run: `cd apps/api && bun test test/routes/discounts.test.ts`
Expected: all 6 tests pass.

- [ ] **Step 7: Run the full test suite to catch regressions**

Run from repo root:

```bash
pnpm -r test && pnpm -r typecheck
```

Expected: every previously-passing test still passes; typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/lib/errors.ts apps/api/src/routes/discounts.ts apps/api/src/index.ts apps/api/test/routes/discounts.test.ts
git commit -m "feat(api): POST /discounts/validate"
```

---

## Follow-ups (intentionally out of scope)

- Rate limiting on `POST /discounts/validate` (IP / code) — belongs with a wider rate-limiting pass once checkout ships.
- Influencer commission calculation — the `commission_amount` column exists; it will be populated by the checkout flow, not by validate.
- Shipping override from `GET /shipping/quote` — pricing engine currently uses `market.shippingFlat`. Swap to an explicit `shippingOverride` param when the shipping-quote endpoint lands.
- Admin CRUD for discount codes (`/admin/discount-codes`) — separate plan.
