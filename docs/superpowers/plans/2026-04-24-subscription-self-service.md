# Subscription Self-Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 5 authenticated endpoints under `/me/subscriptions/*` so a customer can list their subscriptions and mutate them (pause, resume, cancel, change frequency) without ever touching a payment gateway.

**Architecture:** Pure transition engine (`applySubscriptionAction`) encodes the 5×4 state matrix with no I/O. A thin Drizzle repo (`subscriptions.ts`) enforces the cross-customer ownership invariant (reads that belong to another customer return `undefined`, which the route handler translates to `404`). Five route handlers in one file compose repo + service + serializer.

**Tech Stack:** Bun + Hono + Drizzle (postgres.js) + Zod. Builds on the existing `subscriptions` schema + Clerk middleware already in place. Tests via `bun:test` (pure unit + integration against real Postgres through `useTestDb()`).

**Spec:** [docs/superpowers/specs/2026-04-24-subscription-self-service-design.md](../specs/2026-04-24-subscription-self-service-design.md). Read before implementing.

---

## Context cheatsheet (read before Task 1)

- **Error envelope:** `{error: {code, message, details?}}` via `apiError()` from `apps/api/src/lib/errors.ts`.
- **Route pattern:** `createMeRoutes` (in `apps/api/src/routes/me.ts`) takes a single deps object `{verifier, userClient, db, gateway?, getNow?}`. Auth middleware is already applied to every nested route. We mount `/subscriptions` inside `createMeRoutes` **unconditionally** — it doesn't need a gateway.
- **Clock injection:** pass `getNow: () => Date` through. Default in prod is `() => new Date()`; tests pin it.
- **Customer lookup:** on every `/me/*` call, the handler does `upsertCustomerByClerkUserId(db, {clerkUserId, email})` to get the local `customer.id`. Subscriptions are keyed by `customer_id`, not `clerk_user_id`.
- **Subscription status union:** `"active" | "paused" | "canceled" | "past_due" | "delayed_oos"`. Stored as `text`; no CHECK constraint today.
- **Date formatting:** `nextBillingDate` is a Postgres `date` column, handled as `"YYYY-MM-DD"` strings. Compute with `setUTCDate(n + intervalDays)` + `.toISOString().slice(0, 10)` — same pattern as `createOrderFromCart` in the checkout feature.
- **Drizzle + bun:test `.rejects`:** unlike insert/update builders, `await` + `try/catch` works fine. The `Promise.resolve(...)` wrapper is only needed when asserting with `expect().rejects.toThrow()` on a raw insert builder. Route tests assert HTTP responses, not builder promises.
- **`exactOptionalPropertyTypes`:** strict. Use conditional spread for optional fields (`...(x ? { key: x } : {})`).

---

## File Structure

**New:**
- `apps/api/src/services/subscription-actions.ts` — pure transition engine + helper types
- `apps/api/test/services/subscription-actions.test.ts`
- `apps/api/src/repos/subscriptions.ts` — `listByCustomerId`, `getByIdForCustomer`, `updateStatus`
- `apps/api/test/repos/subscriptions.test.ts`
- `apps/api/src/routes/subscriptions.ts` — `createSubscriptionRoutes({db, getNow})`
- `apps/api/test/routes/subscriptions.test.ts`

**Modify:**
- `apps/api/src/lib/errors.ts` — add `subscription_invalid_state` to `ApiErrorCode`
- `apps/api/src/routes/me.ts` — mount `createSubscriptionRoutes` unconditionally

---

## Task 1: Pure transition engine — `applySubscriptionAction`

**Files:**
- Create: `apps/api/src/services/subscription-actions.ts`
- Create: `apps/api/test/services/subscription-actions.test.ts`

Pure function. Given a subscription's current state + a requested action, returns either a partial update payload or a rejection. No I/O, no DB.

- [ ] **Step 1: Write failing tests for the transition matrix**

`apps/api/test/services/subscription-actions.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import type { Subscription } from "../../src/db/schema/subscriptions";
import { applySubscriptionAction } from "../../src/services/subscription-actions";

const FIXED_NOW = new Date("2026-05-01T00:00:00Z");
const getNow = () => FIXED_NOW;

function sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    customerId: "22222222-2222-2222-2222-222222222222",
    originalOrderId: "33333333-3333-3333-3333-333333333333",
    productSlug: "sleep",
    intervalDays: 30,
    unitPrice: 36000,
    quantity: 1,
    market: "mx",
    currency: "MXN",
    status: "active",
    nextBillingDate: "2026-05-24",
    shippingAddress: {},
    createdAt: new Date("2026-04-24T00:00:00Z"),
    updatedAt: new Date("2026-04-24T00:00:00Z"),
    canceledAt: null,
    ...overrides,
  };
}

describe("applySubscriptionAction — pause", () => {
  it("active → paused (no date change)", () => {
    const r = applySubscriptionAction({ sub: sub({ status: "active" }), action: "pause", getNow });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.update).toEqual({ status: "paused" });
    }
  });

  it.each([
    ["paused"],
    ["canceled"],
    ["past_due"],
    ["delayed_oos"],
  ] as const)("rejects pause from %s", (status) => {
    const r = applySubscriptionAction({ sub: sub({ status }), action: "pause", getNow });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("subscription_invalid_state");
      expect(r.currentStatus).toBe(status);
      expect(r.action).toBe("pause");
    }
  });
});

describe("applySubscriptionAction — resume", () => {
  it("paused → active with nextBillingDate = today + intervalDays", () => {
    const r = applySubscriptionAction({
      sub: sub({ status: "paused", intervalDays: 30 }),
      action: "resume",
      getNow,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.update).toEqual({ status: "active", nextBillingDate: "2026-05-31" });
    }
  });

  it("respects intervalDays=90", () => {
    const r = applySubscriptionAction({
      sub: sub({ status: "paused", intervalDays: 90 }),
      action: "resume",
      getNow,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.update.nextBillingDate).toBe("2026-07-30");
  });

  it.each([
    ["active"],
    ["canceled"],
    ["past_due"],
    ["delayed_oos"],
  ] as const)("rejects resume from %s", (status) => {
    const r = applySubscriptionAction({ sub: sub({ status }), action: "resume", getNow });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.currentStatus).toBe(status);
  });
});

describe("applySubscriptionAction — cancel", () => {
  it.each([
    ["active"],
    ["paused"],
    ["past_due"],
    ["delayed_oos"],
  ] as const)("%s → canceled with canceledAt=getNow()", (status) => {
    const r = applySubscriptionAction({ sub: sub({ status }), action: "cancel", getNow });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.update.status).toBe("canceled");
      expect(r.update.canceledAt).toEqual(FIXED_NOW);
    }
  });

  it("rejects cancel on already canceled", () => {
    const r = applySubscriptionAction({ sub: sub({ status: "canceled" }), action: "cancel", getNow });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.currentStatus).toBe("canceled");
  });
});

describe("applySubscriptionAction — frequency", () => {
  it("active 30 → 90 updates intervalDays + nextBillingDate", () => {
    const r = applySubscriptionAction({
      sub: sub({ status: "active", intervalDays: 30 }),
      action: "frequency",
      intervalDays: 90,
      getNow,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.update).toEqual({
        intervalDays: 90,
        nextBillingDate: "2026-07-30",
      });
    }
  });

  it("paused 30 → 60 updates both, status stays paused (no status field in update)", () => {
    const r = applySubscriptionAction({
      sub: sub({ status: "paused", intervalDays: 30 }),
      action: "frequency",
      intervalDays: 60,
      getNow,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.update).toEqual({
        intervalDays: 60,
        nextBillingDate: "2026-06-30",
      });
      expect("status" in r.update).toBe(false);
    }
  });

  it.each([
    ["canceled"],
    ["past_due"],
    ["delayed_oos"],
  ] as const)("rejects frequency from %s", (status) => {
    const r = applySubscriptionAction({
      sub: sub({ status }),
      action: "frequency",
      intervalDays: 60,
      getNow,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.currentStatus).toBe(status);
  });

  it("throws when action is frequency but intervalDays is missing", () => {
    expect(() =>
      applySubscriptionAction({
        sub: sub({ status: "active" }),
        action: "frequency",
        getNow,
      }),
    ).toThrow(/intervalDays is required/);
  });
});
```

- [ ] **Step 2: Run — expect module-not-found**

```bash
cd apps/api && bun test test/services/subscription-actions.test.ts
```

- [ ] **Step 3: Implement the service**

`apps/api/src/services/subscription-actions.ts`:

```typescript
import type { Subscription } from "../db/schema/subscriptions";

export type SubscriptionStatus =
  | "active"
  | "paused"
  | "canceled"
  | "past_due"
  | "delayed_oos";

export type SubscriptionAction = "pause" | "resume" | "cancel" | "frequency";

export type SubscriptionInterval = 30 | 60 | 90;

/**
 * Partial update the route handler applies to the subscription row.
 * Keeping it narrow (only the mutable fields we touch) keeps the repo
 * signature explicit and prevents stray columns from slipping into updates.
 */
export interface SubscriptionUpdate {
  status?: SubscriptionStatus;
  intervalDays?: SubscriptionInterval;
  nextBillingDate?: string; // "YYYY-MM-DD"
  canceledAt?: Date;
}

export type ApplySubscriptionActionResult =
  | { ok: true; update: SubscriptionUpdate }
  | {
      ok: false;
      reason: "subscription_invalid_state";
      currentStatus: SubscriptionStatus;
      action: SubscriptionAction;
    };

export interface ApplySubscriptionActionInput {
  sub: Subscription;
  action: SubscriptionAction;
  getNow: () => Date;
  /** Required only when `action === "frequency"`. Otherwise ignored. */
  intervalDays?: SubscriptionInterval;
}

function addDaysUtc(base: Date, days: number): string {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function reject(
  currentStatus: SubscriptionStatus,
  action: SubscriptionAction,
): ApplySubscriptionActionResult {
  return { ok: false, reason: "subscription_invalid_state", currentStatus, action };
}

export function applySubscriptionAction(
  input: ApplySubscriptionActionInput,
): ApplySubscriptionActionResult {
  const status = input.sub.status as SubscriptionStatus;

  if (input.action === "pause") {
    if (status !== "active") return reject(status, "pause");
    return { ok: true, update: { status: "paused" } };
  }

  if (input.action === "resume") {
    if (status !== "paused") return reject(status, "resume");
    return {
      ok: true,
      update: {
        status: "active",
        nextBillingDate: addDaysUtc(input.getNow(), input.sub.intervalDays),
      },
    };
  }

  if (input.action === "cancel") {
    if (status === "canceled") return reject(status, "cancel");
    return {
      ok: true,
      update: { status: "canceled", canceledAt: input.getNow() },
    };
  }

  // action === "frequency"
  if (input.intervalDays === undefined) {
    throw new Error("applySubscriptionAction: intervalDays is required for frequency action");
  }
  if (status !== "active" && status !== "paused") {
    return reject(status, "frequency");
  }
  return {
    ok: true,
    update: {
      intervalDays: input.intervalDays,
      nextBillingDate: addDaysUtc(input.getNow(), input.intervalDays),
    },
  };
}
```

- [ ] **Step 4: Run — expect all pass**

```bash
cd apps/api && bun test test/services/subscription-actions.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/subscription-actions.ts apps/api/test/services/subscription-actions.test.ts
git commit -m "feat(api): applySubscriptionAction pure transition engine"
```

---

## Task 2: `subscriptions` repo — `listByCustomerId` + `getByIdForCustomer` + `updateStatus`

**Files:**
- Create: `apps/api/src/repos/subscriptions.ts`
- Create: `apps/api/test/repos/subscriptions.test.ts`

Repo pattern follows `apps/api/src/repos/customers.ts` and `repos/discount-codes.ts`: typed inputs, `Db` first arg, returns row(s) or `undefined`. `getByIdForCustomer` enforces the cross-customer invariant — that's the single place where "who owns what" is checked.

- [ ] **Step 1: Write failing tests**

`apps/api/test/repos/subscriptions.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { useTestDb } from "../helpers/db";
import { customers } from "../../src/db/schema/customers";
import { orders } from "../../src/db/schema/orders";
import { subscriptions, type NewSubscription } from "../../src/db/schema/subscriptions";
import {
  listByCustomerId,
  getByIdForCustomer,
  updateStatus,
} from "../../src/repos/subscriptions";

async function seedCustomer(db: ReturnType<typeof useTestDb>["getDb"] extends () => infer T ? T : never, clerkUserId: string, email: string) {
  const [c] = await db
    .insert(customers)
    .values({ clerkUserId, email })
    .returning();
  return c!;
}

async function seedOrder(db: ReturnType<typeof useTestDb>["getDb"] extends () => infer T ? T : never, customerId: string) {
  const [o] = await db
    .insert(orders)
    .values({
      customerId,
      market: "mx",
      currency: "MXN",
      subtotal: 45000,
      tax: 7200,
      shipping: 8500,
      discountAmount: 0,
      total: 60700,
      status: "paid",
      paymentProvider: "stub",
      shippingAddress: {},
    })
    .returning();
  return o!;
}

async function seedSub(
  db: ReturnType<typeof useTestDb>["getDb"] extends () => infer T ? T : never,
  customerId: string,
  originalOrderId: string,
  overrides: Partial<NewSubscription> = {},
) {
  const [s] = await db
    .insert(subscriptions)
    .values({
      customerId,
      originalOrderId,
      productSlug: "sleep",
      intervalDays: 30,
      unitPrice: 36000,
      quantity: 1,
      market: "mx",
      currency: "MXN",
      status: "active",
      nextBillingDate: "2026-05-24",
      shippingAddress: {},
      ...overrides,
    })
    .returning();
  return s!;
}

describe("subscriptions repo — listByCustomerId", () => {
  const { getDb } = useTestDb();

  it("returns only the caller's subs, sorted by createdAt DESC", async () => {
    const db = getDb();
    const alice = await seedCustomer(db, "u_alice", "a@example.com");
    const bob = await seedCustomer(db, "u_bob", "b@example.com");
    const aliceOrder = await seedOrder(db, alice.id);
    const bobOrder = await seedOrder(db, bob.id);

    const aliceFirst = await seedSub(db, alice.id, aliceOrder.id, { productSlug: "energy" });
    // Tiny delay to ensure the second row has a later createdAt.
    await Bun.sleep(10);
    const aliceSecond = await seedSub(db, alice.id, aliceOrder.id, { productSlug: "sleep" });
    await seedSub(db, bob.id, bobOrder.id, { productSlug: "glow" });

    const rows = await listByCustomerId(db, alice.id);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.id).toBe(aliceSecond.id);
    expect(rows[1]?.id).toBe(aliceFirst.id);
  });

  it("returns empty array when the customer has none", async () => {
    const db = getDb();
    const alice = await seedCustomer(db, "u_empty", "e@example.com");
    const rows = await listByCustomerId(db, alice.id);
    expect(rows).toEqual([]);
  });
});

describe("subscriptions repo — getByIdForCustomer", () => {
  const { getDb } = useTestDb();

  it("returns the row when the sub belongs to the customer", async () => {
    const db = getDb();
    const alice = await seedCustomer(db, "u_a", "a@example.com");
    const order = await seedOrder(db, alice.id);
    const created = await seedSub(db, alice.id, order.id);

    const got = await getByIdForCustomer(db, { id: created.id, customerId: alice.id });
    expect(got?.id).toBe(created.id);
  });

  it("returns undefined when the id doesn't exist", async () => {
    const db = getDb();
    const alice = await seedCustomer(db, "u_a2", "a@example.com");
    const got = await getByIdForCustomer(db, {
      id: "00000000-0000-0000-0000-000000000000",
      customerId: alice.id,
    });
    expect(got).toBeUndefined();
  });

  it("returns undefined when the id belongs to a different customer (no leak)", async () => {
    const db = getDb();
    const alice = await seedCustomer(db, "u_a3", "a@example.com");
    const bob = await seedCustomer(db, "u_b3", "b@example.com");
    const bobOrder = await seedOrder(db, bob.id);
    const bobSub = await seedSub(db, bob.id, bobOrder.id);

    const got = await getByIdForCustomer(db, { id: bobSub.id, customerId: alice.id });
    expect(got).toBeUndefined();
  });
});

describe("subscriptions repo — updateStatus", () => {
  const { getDb } = useTestDb();

  it("persists status + nextBillingDate + canceledAt + intervalDays when provided", async () => {
    const db = getDb();
    const alice = await seedCustomer(db, "u_u", "u@example.com");
    const order = await seedOrder(db, alice.id);
    const s = await seedSub(db, alice.id, order.id, { status: "active", intervalDays: 30 });

    const canceledAt = new Date("2026-05-10T00:00:00Z");
    const updated = await updateStatus(db, {
      id: s.id,
      status: "canceled",
      canceledAt,
    });

    expect(updated.status).toBe("canceled");
    expect(updated.canceledAt?.toISOString()).toBe(canceledAt.toISOString());
  });

  it("partial update: only touches provided fields", async () => {
    const db = getDb();
    const alice = await seedCustomer(db, "u_p", "p@example.com");
    const order = await seedOrder(db, alice.id);
    const s = await seedSub(db, alice.id, order.id, {
      status: "active",
      intervalDays: 30,
      nextBillingDate: "2026-05-24",
    });

    const updated = await updateStatus(db, {
      id: s.id,
      status: "paused",
    });

    expect(updated.status).toBe("paused");
    expect(updated.intervalDays).toBe(30);
    expect(updated.nextBillingDate).toBe("2026-05-24");
    expect(updated.canceledAt).toBeNull();
  });

  it("throws when the id doesn't exist", async () => {
    const db = getDb();
    await expect(
      updateStatus(db, {
        id: "00000000-0000-0000-0000-000000000000",
        status: "canceled",
        canceledAt: new Date(),
      }),
    ).rejects.toThrow(/no subscription with id/);
  });
});
```

- [ ] **Step 2: Run — expect module-not-found**

```bash
cd apps/api && bun test test/repos/subscriptions.test.ts
```

- [ ] **Step 3: Implement the repo**

`apps/api/src/repos/subscriptions.ts`:

```typescript
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../db";
import { subscriptions, type Subscription } from "../db/schema/subscriptions";
import type { SubscriptionInterval, SubscriptionStatus } from "../services/subscription-actions";

export async function listByCustomerId(db: Db, customerId: string): Promise<Subscription[]> {
  return await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.customerId, customerId))
    .orderBy(desc(subscriptions.createdAt));
}

export interface GetByIdForCustomerInput {
  id: string;
  customerId: string;
}

/**
 * Returns the subscription when it exists AND belongs to the given customer.
 * Returns undefined in every other case — same response for "doesn't exist"
 * and "exists but isn't yours" so routes can translate to a uniform 404.
 */
export async function getByIdForCustomer(
  db: Db,
  { id, customerId }: GetByIdForCustomerInput,
): Promise<Subscription | undefined> {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.id, id), eq(subscriptions.customerId, customerId)))
    .limit(1);
  return row;
}

export interface UpdateStatusInput {
  id: string;
  status?: SubscriptionStatus;
  intervalDays?: SubscriptionInterval;
  nextBillingDate?: string;
  canceledAt?: Date;
}

/**
 * Partial update — only the provided fields are written. `updatedAt` is
 * advanced by the schema-level $onUpdate hook, but we set it explicitly
 * as well because onConflict/update paths sometimes miss it in Drizzle.
 */
export async function updateStatus(
  db: Db,
  input: UpdateStatusInput,
): Promise<Subscription> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (input.status !== undefined) set.status = input.status;
  if (input.intervalDays !== undefined) set.intervalDays = input.intervalDays;
  if (input.nextBillingDate !== undefined) set.nextBillingDate = input.nextBillingDate;
  if (input.canceledAt !== undefined) set.canceledAt = input.canceledAt;

  const [row] = await db
    .update(subscriptions)
    .set(set)
    .where(eq(subscriptions.id, input.id))
    .returning();
  if (!row) throw new Error(`updateStatus: no subscription with id ${input.id}`);
  return row;
}
```

- [ ] **Step 4: Run — expect all pass**

```bash
cd apps/api && bun test test/repos/subscriptions.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/repos/subscriptions.ts apps/api/test/repos/subscriptions.test.ts
git commit -m "feat(api): subscriptions repo — list + getByIdForCustomer + updateStatus"
```

---

## Task 3: `/me/subscriptions/*` routes — `GET` list + 4 mutations

**Files:**
- Modify: `apps/api/src/lib/errors.ts` (add 1 new code)
- Create: `apps/api/src/routes/subscriptions.ts`
- Modify: `apps/api/src/routes/me.ts` (mount the new routes)
- Create: `apps/api/test/routes/subscriptions.test.ts`

- [ ] **Step 1: Extend `ApiErrorCode`**

Edit `apps/api/src/lib/errors.ts`. Add `subscription_invalid_state` to the union (keep all existing codes):

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
  | "discount_max_per_customer_reached"
  | "idempotency_key_missing"
  | "payment_declined"
  | "gateway_error"
  | "subscription_invalid_state";
```

- [ ] **Step 2: Write failing route tests**

`apps/api/test/routes/subscriptions.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { eq } from "drizzle-orm";
import { createApp } from "../../src/index";
import { createStubVerifier, createStubUserClient } from "../../src/lib/clerk";
import { useTestDb } from "../helpers/db";
import { persistOrder } from "../../src/repos/orders";
import { subscriptions } from "../../src/db/schema/subscriptions";

const FIXED_NOW = new Date("2026-05-01T00:00:00Z");
const SHIPPING = {
  line1: "Av. X 1",
  city: "CDMX",
  state: "CDMX",
  postalCode: "00000",
  country: "MX",
};

function buildApp(getDb: ReturnType<typeof useTestDb>["getDb"]) {
  const verifier = createStubVerifier({
    tok_alice: { clerkUserId: "user_alice" },
    tok_bob: { clerkUserId: "user_bob" },
  });
  const userClient = createStubUserClient({
    user_alice: { clerkUserId: "user_alice", email: "alice@example.com" },
    user_bob: { clerkUserId: "user_bob", email: "bob@example.com" },
  });
  return createApp({
    verifier,
    userClient,
    db: getDb(),
    getNow: () => FIXED_NOW,
  });
}

async function seedSubViaPersist(
  db: ReturnType<typeof useTestDb>["getDb"] extends () => infer T ? T : never,
  customerId: string,
  opts: {
    intervalDays?: 30 | 60 | 90;
    status?: "active" | "paused" | "canceled" | "past_due" | "delayed_oos";
    nextBillingDate?: string;
    productSlug?: "energy" | "sleep" | "glow" | "shield" | "zen" | "woman";
  } = {},
) {
  const intervalDays = opts.intervalDays ?? 30;
  const productSlug = opts.productSlug ?? "sleep";
  const res = await persistOrder(db, {
    order: {
      customerId,
      market: "mx",
      currency: "MXN",
      subtotal: 36000,
      tax: 5760,
      shipping: 8500,
      discountAmount: 0,
      total: 50260,
      status: "paid",
      paymentProvider: "stub",
      paymentChargeId: "stub_seed",
      shippingAddress: SHIPPING,
      idempotencyKey: `seed_${crypto.randomUUID()}`,
    },
    orderItems: [
      {
        productSlug,
        name: productSlug,
        unitPrice: 36000,
        quantity: 1,
        isSubscription: true,
        intervalDays,
        discountPct: 20,
      },
    ],
    subscriptions: [
      {
        customerId,
        productSlug,
        intervalDays,
        unitPrice: 36000,
        quantity: 1,
        market: "mx",
        currency: "MXN",
        status: opts.status ?? "active",
        nextBillingDate: opts.nextBillingDate ?? "2026-05-24",
        shippingAddress: SHIPPING,
      },
    ],
  });
  return res.subscriptionIds[0]!;
}

async function ensureCustomer(
  app: ReturnType<typeof createApp>,
  bearer: string,
): Promise<string> {
  const res = await app.fetch(
    new Request("http://localhost/me/customer", {
      headers: { Authorization: bearer },
    }),
  );
  const body = (await res.json()) as { id: string };
  return body.id;
}

function request(
  app: ReturnType<typeof createApp>,
  path: string,
  opts: { method?: string; auth?: string; body?: unknown } = {},
) {
  const headers: Record<string, string> = {};
  if (opts.auth !== undefined) headers.Authorization = opts.auth;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  return app.fetch(
    new Request(`http://localhost${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    }),
  );
}

describe("GET /me/subscriptions", () => {
  const { getDb } = useTestDb();

  it("401 without Authorization", async () => {
    const app = buildApp(getDb);
    const res = await request(app, "/me/subscriptions");
    expect(res.status).toBe(401);
  });

  it("returns only the caller's subs, sorted by createdAt DESC", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const bobId = await ensureCustomer(app, "Bearer tok_bob");

    const firstAlice = await seedSubViaPersist(db, aliceId, { productSlug: "energy" });
    await Bun.sleep(10);
    const secondAlice = await seedSubViaPersist(db, aliceId, { productSlug: "sleep" });
    await seedSubViaPersist(db, bobId, { productSlug: "glow" });

    const res = await request(app, "/me/subscriptions", { auth: "Bearer tok_alice" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { subscriptions: Array<{ id: string }> };
    expect(body.subscriptions).toHaveLength(2);
    expect(body.subscriptions[0]?.id).toBe(secondAlice);
    expect(body.subscriptions[1]?.id).toBe(firstAlice);
  });
});

describe("POST /me/subscriptions/:id/pause", () => {
  const { getDb } = useTestDb();

  it("200 on active → status paused", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const subId = await seedSubViaPersist(db, aliceId, { status: "active" });

    const res = await request(app, `/me/subscriptions/${subId}/pause`, {
      method: "POST",
      auth: "Bearer tok_alice",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("paused");
  });

  it("409 subscription_invalid_state on paused", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const subId = await seedSubViaPersist(db, aliceId, { status: "paused" });

    const res = await request(app, `/me/subscriptions/${subId}/pause`, {
      method: "POST",
      auth: "Bearer tok_alice",
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string; details?: { currentStatus: string; action: string } } };
    expect(body.error.code).toBe("subscription_invalid_state");
    expect(body.error.details?.currentStatus).toBe("paused");
    expect(body.error.details?.action).toBe("pause");
  });

  it("404 when sub belongs to another customer", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const bobId = await ensureCustomer(app, "Bearer tok_bob");
    const bobSub = await seedSubViaPersist(db, bobId, { status: "active" });

    const res = await request(app, `/me/subscriptions/${bobSub}/pause`, {
      method: "POST",
      auth: "Bearer tok_alice",
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("not_found");

    // And the row was NOT mutated — still active for bob.
    const stillActive = await db.select().from(subscriptions).where(eq(subscriptions.id, bobSub));
    expect(stillActive[0]?.status).toBe("active");
  });

  it("404 when sub doesn't exist", async () => {
    const app = buildApp(getDb);
    await ensureCustomer(app, "Bearer tok_alice");
    const res = await request(
      app,
      "/me/subscriptions/00000000-0000-0000-0000-000000000000/pause",
      { method: "POST", auth: "Bearer tok_alice" },
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /me/subscriptions/:id/resume", () => {
  const { getDb } = useTestDb();

  it("200 on paused → status active, nextBillingDate = today + intervalDays", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const subId = await seedSubViaPersist(db, aliceId, {
      status: "paused",
      intervalDays: 30,
      nextBillingDate: "2026-04-01",
    });

    const res = await request(app, `/me/subscriptions/${subId}/resume`, {
      method: "POST",
      auth: "Bearer tok_alice",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; nextBillingDate: string };
    expect(body.status).toBe("active");
    expect(body.nextBillingDate).toBe("2026-05-31");
  });

  it("409 when already active", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const subId = await seedSubViaPersist(db, aliceId, { status: "active" });
    const res = await request(app, `/me/subscriptions/${subId}/resume`, {
      method: "POST",
      auth: "Bearer tok_alice",
    });
    expect(res.status).toBe(409);
  });
});

describe("POST /me/subscriptions/:id/cancel", () => {
  const { getDb } = useTestDb();

  it("200 on active → canceled with canceledAt set", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const subId = await seedSubViaPersist(db, aliceId, { status: "active" });

    const res = await request(app, `/me/subscriptions/${subId}/cancel`, {
      method: "POST",
      auth: "Bearer tok_alice",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; canceledAt: string | null };
    expect(body.status).toBe("canceled");
    expect(body.canceledAt).toBe(FIXED_NOW.toISOString());
  });

  it("200 on paused → canceled", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const subId = await seedSubViaPersist(db, aliceId, { status: "paused" });
    const res = await request(app, `/me/subscriptions/${subId}/cancel`, {
      method: "POST",
      auth: "Bearer tok_alice",
    });
    expect(res.status).toBe(200);
  });

  it("200 on past_due → canceled", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const subId = await seedSubViaPersist(db, aliceId, { status: "past_due" });
    const res = await request(app, `/me/subscriptions/${subId}/cancel`, {
      method: "POST",
      auth: "Bearer tok_alice",
    });
    expect(res.status).toBe(200);
  });

  it("409 on already canceled", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const subId = await seedSubViaPersist(db, aliceId, { status: "canceled" });
    const res = await request(app, `/me/subscriptions/${subId}/cancel`, {
      method: "POST",
      auth: "Bearer tok_alice",
    });
    expect(res.status).toBe(409);
  });
});

describe("POST /me/subscriptions/:id/frequency", () => {
  const { getDb } = useTestDb();

  it("200 on active 30 → 90: intervalDays + nextBillingDate updated", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const subId = await seedSubViaPersist(db, aliceId, { status: "active", intervalDays: 30 });

    const res = await request(app, `/me/subscriptions/${subId}/frequency`, {
      method: "POST",
      auth: "Bearer tok_alice",
      body: { intervalDays: 90 },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      intervalDays: number;
      nextBillingDate: string;
    };
    expect(body.status).toBe("active");
    expect(body.intervalDays).toBe(90);
    expect(body.nextBillingDate).toBe("2026-07-30");
  });

  it("200 on paused 30 → 60: stays paused", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const subId = await seedSubViaPersist(db, aliceId, { status: "paused", intervalDays: 30 });
    const res = await request(app, `/me/subscriptions/${subId}/frequency`, {
      method: "POST",
      auth: "Bearer tok_alice",
      body: { intervalDays: 60 },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; intervalDays: number };
    expect(body.status).toBe("paused");
    expect(body.intervalDays).toBe(60);
  });

  it("400 validation_failed on invalid intervalDays", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const subId = await seedSubViaPersist(db, aliceId, { status: "active" });
    const res = await request(app, `/me/subscriptions/${subId}/frequency`, {
      method: "POST",
      auth: "Bearer tok_alice",
      body: { intervalDays: 45 },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("validation_failed");
  });

  it("409 on canceled", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const subId = await seedSubViaPersist(db, aliceId, { status: "canceled" });
    const res = await request(app, `/me/subscriptions/${subId}/frequency`, {
      method: "POST",
      auth: "Bearer tok_alice",
      body: { intervalDays: 60 },
    });
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 3: Run — expect route not wired (404 / module-not-found)**

```bash
cd apps/api && bun test test/routes/subscriptions.test.ts
```

- [ ] **Step 4: Implement the routes**

`apps/api/src/routes/subscriptions.ts`:

```typescript
import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../db";
import type { ClerkUserClient } from "../lib/clerk";
import { apiError } from "../lib/errors";
import { upsertCustomerByClerkUserId } from "../repos/customers";
import {
  listByCustomerId,
  getByIdForCustomer,
  updateStatus,
} from "../repos/subscriptions";
import {
  applySubscriptionAction,
  type SubscriptionAction,
} from "../services/subscription-actions";
import type { Subscription } from "../db/schema/subscriptions";

const FrequencyBodySchema = z.object({
  intervalDays: z.union([z.literal(30), z.literal(60), z.literal(90)]),
});

export interface SubscriptionRoutesDeps {
  db: Db;
  userClient: ClerkUserClient;
  getNow: () => Date;
}

function serialize(s: Subscription) {
  return {
    id: s.id,
    productSlug: s.productSlug,
    intervalDays: s.intervalDays,
    unitPrice: s.unitPrice,
    quantity: s.quantity,
    market: s.market,
    currency: s.currency,
    status: s.status,
    nextBillingDate: s.nextBillingDate,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    canceledAt: s.canceledAt ? s.canceledAt.toISOString() : null,
  };
}

async function resolveCustomer(
  deps: SubscriptionRoutesDeps,
  clerkUserId: string,
): Promise<{ id: string }> {
  const { email } = await deps.userClient.getUser(clerkUserId);
  return await upsertCustomerByClerkUserId(deps.db, { clerkUserId, email });
}

export function createSubscriptionRoutes(deps: SubscriptionRoutesDeps): Hono {
  const r = new Hono();

  r.get("/", async (c) => {
    const clerkUserId = c.get("clerkUserId");
    const customer = await resolveCustomer(deps, clerkUserId);
    const rows = await listByCustomerId(deps.db, customer.id);
    return c.json({ subscriptions: rows.map(serialize) });
  });

  async function runMutation(
    c: Parameters<Parameters<Hono["post"]>[1]>[0],
    action: SubscriptionAction,
    intervalDays?: 30 | 60 | 90,
  ) {
    const clerkUserId = c.get("clerkUserId");
    const customer = await resolveCustomer(deps, clerkUserId);
    const id = c.req.param("id");
    if (!id) {
      const { body, status } = apiError("not_found", "subscription not found", 404);
      return c.json(body, status);
    }
    const existing = await getByIdForCustomer(deps.db, { id, customerId: customer.id });
    if (!existing) {
      const { body, status } = apiError("not_found", "subscription not found", 404);
      return c.json(body, status);
    }

    const result = applySubscriptionAction({
      sub: existing,
      action,
      getNow: deps.getNow,
      ...(intervalDays !== undefined ? { intervalDays } : {}),
    });

    if (!result.ok) {
      const { body, status } = apiError(
        "subscription_invalid_state",
        `action '${result.action}' not allowed from status '${result.currentStatus}'`,
        409,
        { currentStatus: result.currentStatus, action: result.action },
      );
      return c.json(body, status);
    }

    const updated = await updateStatus(deps.db, {
      id,
      ...result.update,
    });
    return c.json(serialize(updated));
  }

  r.post("/:id/pause", (c) => runMutation(c, "pause"));
  r.post("/:id/resume", (c) => runMutation(c, "resume"));
  r.post("/:id/cancel", (c) => runMutation(c, "cancel"));

  r.post("/:id/frequency", async (c) => {
    const parsed = FrequencyBodySchema.safeParse(
      await c.req.json().catch(() => ({})),
    );
    if (!parsed.success) {
      const { body, status } = apiError(
        "validation_failed",
        "invalid request body",
        400,
        parsed.error.flatten(),
      );
      return c.json(body, status);
    }
    return runMutation(c, "frequency", parsed.data.intervalDays);
  });

  return r;
}
```

- [ ] **Step 5: Mount the route in `createMeRoutes`**

Edit `apps/api/src/routes/me.ts`. Add the import:

```typescript
import { createSubscriptionRoutes } from "./subscriptions";
```

Inside `createMeRoutes`, after the existing `/customer` handler block and before the `if (deps.gateway) { ... }` block, add the subscriptions mount:

```typescript
  me.route(
    "/subscriptions",
    createSubscriptionRoutes({
      db: deps.db,
      userClient: deps.userClient,
      getNow: deps.getNow ?? (() => new Date()),
    }),
  );
```

Note: this mount is **unconditional** — no gateway required. The existing checkout mount under `/checkout` still depends on `deps.gateway`.

- [ ] **Step 6: Run the new tests + full suite**

```bash
cd apps/api && bun test test/routes/subscriptions.test.ts
cd apps/api && bun test && bun run typecheck
```

Expected: all new tests pass (15+); no regressions; typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/lib/errors.ts apps/api/src/routes/subscriptions.ts apps/api/src/routes/me.ts apps/api/test/routes/subscriptions.test.ts
git commit -m "feat(api): /me/subscriptions — list + pause/resume/cancel/frequency"
```

---

## Self-Review (done, no action required here)

- **Spec coverage:** every bullet in the spec maps to a task:
  - State transition matrix → Task 1 (pure engine tests) + Task 3 (integration coverage)
  - Repo with ownership invariant → Task 2
  - 5 endpoints + serialization → Task 3
  - New `ApiErrorCode` literal → Task 3 Step 1
  - Mount in `createMeRoutes` → Task 3 Step 5
- **Placeholders:** none.
- **Type consistency:** `SubscriptionUpdate` field names (`status`, `intervalDays`, `nextBillingDate`, `canceledAt`) match the repo's `UpdateStatusInput` and the schema. The pure engine's return shape feeds directly into `updateStatus` via `{ id, ...result.update }`.

---

## Follow-ups (intentionally out of scope)

- Frontend UI for `/cuenta/suscripciones` (list + per-sub actions).
- Admin endpoints (`GET /admin/subscriptions`, admin pause/cancel with override).
- Event emission (`subscription.paused`, `subscription.resumed`, etc.) for the Resend email plan.
- Pagination on `GET /me/subscriptions` (cursor-based when a customer accumulates 50+ subs).
- Reason capture on pause/cancel (adds a nullable `reason` column + body field).
- Reactivation of a canceled subscription (product decision — today `canceled` is terminal).
- Mid-cycle proration on frequency change (current semantics: no re-charge, no refund).
