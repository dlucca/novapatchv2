import { describe, it, expect } from "bun:test";
import { eq } from "drizzle-orm";
import { useTestDb } from "../helpers/db";
import { customers, type NewCustomer } from "../../src/db/schema/customers";
import { orders } from "../../src/db/schema/orders";
import {
  subscriptions,
  type NewSubscription,
  type Subscription,
} from "../../src/db/schema/subscriptions";
import { subscriptionRuns } from "../../src/db/schema/subscription-runs";
import { paymentAttempts } from "../../src/db/schema/payment-attempts";
import { createStubGateway } from "../../src/lib/payment-gateway";
import { materializeDueSubscriptions } from "../../src/services/materialize-due-subscriptions";
import { processSubscriptionRun } from "../../src/services/process-subscription-run";
import { runSubscriptionCron } from "../../src/services/run-subscription-cron";

const FIXED_NOW = new Date("2026-05-15T08:00:00.000Z");

type Db = ReturnType<ReturnType<typeof useTestDb>["getDb"]>;

async function seedCustomer(
  db: Db,
  overrides: Partial<NewCustomer> = {},
): Promise<{ id: string }> {
  const [c] = await db
    .insert(customers)
    .values({
      clerkUserId: `u_${Math.random().toString(36).slice(2)}`,
      email: `${Math.random().toString(36).slice(2)}@example.com`,
      ...overrides,
    })
    .returning();
  if (!c) throw new Error("seedCustomer returned no row");
  return c;
}

async function seedOrder(db: Db, customerId: string): Promise<{ id: string }> {
  const [o] = await db
    .insert(orders)
    .values({
      customerId,
      market: "mx",
      currency: "MXN",
      subtotal: 36000,
      tax: 0,
      shipping: 8500,
      discountAmount: 0,
      total: 44500,
      status: "paid",
      paymentProvider: "stub",
      shippingAddress: { line1: "Av X", city: "CDMX", state: "CDMX", postalCode: "01000", country: "MX" },
    })
    .returning();
  if (!o) throw new Error("seedOrder returned no row");
  return o;
}

async function seedSub(
  db: Db,
  customerId: string,
  originalOrderId: string,
  overrides: Partial<NewSubscription> = {},
): Promise<Subscription> {
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
      nextBillingDate: "2026-05-15",
      shippingAddress: {
        line1: "Av X",
        city: "CDMX",
        state: "CDMX",
        postalCode: "01000",
        country: "MX",
      },
      ...overrides,
    })
    .returning();
  if (!s) throw new Error("seedSub returned no row");
  return s;
}

describe("materializeDueSubscriptions", () => {
  const { getDb } = useTestDb();

  it("creates a pending run for each active sub due today", async () => {
    const db = getDb();
    const c = await seedCustomer(db);
    const o = await seedOrder(db, c.id);
    await seedSub(db, c.id, o.id, { nextBillingDate: "2026-05-14" });
    await seedSub(db, c.id, o.id, { nextBillingDate: "2026-05-15" });

    const r = await materializeDueSubscriptions(db, FIXED_NOW);
    expect(r.subscriptionsConsidered).toBe(2);
    expect(r.runsCreated).toBe(2);
    expect(r.runsAlreadyExisted).toBe(0);

    const runs = await db.select().from(subscriptionRuns);
    expect(runs).toHaveLength(2);
    expect(runs.every((r) => r.status === "pending")).toBe(true);
    expect(runs.every((r) => r.cycleNumber === 1)).toBe(true);
  });

  it("ignores subs not due yet", async () => {
    const db = getDb();
    const c = await seedCustomer(db);
    const o = await seedOrder(db, c.id);
    await seedSub(db, c.id, o.id, { nextBillingDate: "2026-05-16" });

    const r = await materializeDueSubscriptions(db, FIXED_NOW);
    expect(r.subscriptionsConsidered).toBe(0);
    expect(r.runsCreated).toBe(0);
  });

  it("ignores non-active subs (paused/canceled/past_due)", async () => {
    const db = getDb();
    const c = await seedCustomer(db);
    const o = await seedOrder(db, c.id);
    await seedSub(db, c.id, o.id, { status: "paused", nextBillingDate: "2026-05-10" });
    await seedSub(db, c.id, o.id, { status: "canceled", nextBillingDate: "2026-05-10" });
    await seedSub(db, c.id, o.id, { status: "past_due", nextBillingDate: "2026-05-10" });

    const r = await materializeDueSubscriptions(db, FIXED_NOW);
    expect(r.subscriptionsConsidered).toBe(0);
    const runs = await db.select().from(subscriptionRuns);
    expect(runs).toHaveLength(0);
  });

  it("is idempotent: second call same day creates no new runs", async () => {
    const db = getDb();
    const c = await seedCustomer(db);
    const o = await seedOrder(db, c.id);
    await seedSub(db, c.id, o.id);

    const first = await materializeDueSubscriptions(db, FIXED_NOW);
    expect(first.runsCreated).toBe(1);

    const second = await materializeDueSubscriptions(db, FIXED_NOW);
    expect(second.runsCreated).toBe(0);
    expect(second.runsAlreadyExisted).toBe(1);

    const runs = await db.select().from(subscriptionRuns);
    expect(runs).toHaveLength(1);
  });

  it("increments cycle_number for subsequent cycles of the same sub", async () => {
    const db = getDb();
    const c = await seedCustomer(db);
    const o = await seedOrder(db, c.id);
    const sub = await seedSub(db, c.id, o.id, { nextBillingDate: "2026-04-15" });

    // Materialize cycle 1
    await materializeDueSubscriptions(db, new Date("2026-04-15T00:00:00.000Z"));
    // Manually advance the sub to simulate processor success
    await db
      .update(subscriptions)
      .set({ nextBillingDate: "2026-05-15" })
      .where(eq(subscriptions.id, sub.id));
    // Materialize cycle 2
    await materializeDueSubscriptions(db, FIXED_NOW);

    const runs = await db
      .select()
      .from(subscriptionRuns)
      .where(eq(subscriptionRuns.subscriptionId, sub.id));
    const cycles = runs.map((r) => r.cycleNumber).sort();
    expect(cycles).toEqual([1, 2]);
  });
});

describe("processSubscriptionRun", () => {
  const { getDb } = useTestDb();

  it("fails with missing_payment_method when customer has no gateway IDs (legacy subs)", async () => {
    const db = getDb();
    const c = await seedCustomer(db); // no gatewayCustomerIds, no defaultCardId
    const o = await seedOrder(db, c.id);
    const sub = await seedSub(db, c.id, o.id);
    await materializeDueSubscriptions(db, FIXED_NOW);

    const [run] = await db.select().from(subscriptionRuns);
    expect(run).toBeDefined();

    const gateway = createStubGateway({ defaultRecurringOutcome: "succeeded" });
    const outcome = await processSubscriptionRun(
      { db, gateway, getNow: () => FIXED_NOW },
      run!,
    );

    expect(outcome.kind).toBe("failed");
    if (outcome.kind !== "failed") throw new Error("expected failed");
    expect(outcome.reason).toBe("missing_payment_method");

    // Sub is past_due
    const [saved] = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id));
    expect(saved?.status).toBe("past_due");

    // No order created
    const allOrders = await db.select().from(orders);
    expect(allOrders).toHaveLength(1); // only the original signup order
  });

  it("succeeds end-to-end when customer has gateway + PM and gateway returns succeeded", async () => {
    const db = getDb();
    const c = await seedCustomer(db, {
      gatewayCustomerIds: { stub: "cus_test_1" } as unknown as { stripe?: string },
      defaultCardId: "pm_test_1",
    });
    const o = await seedOrder(db, c.id);
    const sub = await seedSub(db, c.id, o.id);
    await materializeDueSubscriptions(db, FIXED_NOW);
    const [run] = await db.select().from(subscriptionRuns);

    const gateway = createStubGateway({ defaultRecurringOutcome: "succeeded" });
    const outcome = await processSubscriptionRun(
      { db, gateway, getNow: () => FIXED_NOW },
      run!,
    );

    expect(outcome.kind).toBe("succeeded");
    if (outcome.kind !== "succeeded") throw new Error("expected succeeded");

    // Renewal order created
    const renewalOrder = await db
      .select()
      .from(orders)
      .where(eq(orders.id, outcome.orderId));
    expect(renewalOrder[0]?.idempotencyKey).toBe(`subrun_${run!.id}`);
    expect(renewalOrder[0]?.paymentProvider).toBe("stub");
    // MX prices are tax-inclusive: subtotal 36000 + shipping 8500 = total 44500
    expect(renewalOrder[0]?.subtotal).toBe(36000);
    expect(renewalOrder[0]?.tax).toBe(0);
    expect(renewalOrder[0]?.shipping).toBe(8500);
    expect(renewalOrder[0]?.total).toBe(44500);

    // payment_attempt mirrors success
    const attempts = await db
      .select()
      .from(paymentAttempts)
      .where(eq(paymentAttempts.orderId, outcome.orderId));
    expect(attempts[0]?.status).toBe("succeeded");
    expect(attempts[0]?.providerCustomerId).toBe("cus_test_1");

    // Run marked succeeded with orderId
    const [updatedRun] = await db
      .select()
      .from(subscriptionRuns)
      .where(eq(subscriptionRuns.id, run!.id));
    expect(updatedRun?.status).toBe("succeeded");
    expect(updatedRun?.orderId).toBe(outcome.orderId);
    expect(updatedRun?.attemptCount).toBe(1);

    // Subscription advanced by intervalDays from previous nextBillingDate
    // (2026-05-15 + 30d = 2026-06-14)
    const [updatedSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, sub.id));
    expect(updatedSub?.nextBillingDate).toBe("2026-06-14");
    expect(updatedSub?.status).toBe("active"); // still active
  });

  it("declined → run failed + sub past_due, no order created", async () => {
    const db = getDb();
    const c = await seedCustomer(db, {
      gatewayCustomerIds: { stub: "cus_test_2" } as unknown as { stripe?: string },
      defaultCardId: "pm_test_2",
    });
    const o = await seedOrder(db, c.id);
    const sub = await seedSub(db, c.id, o.id);
    await materializeDueSubscriptions(db, FIXED_NOW);
    const [run] = await db.select().from(subscriptionRuns);

    const gateway = createStubGateway({
      defaultRecurringOutcome: "declined",
      declineReason: "card_declined",
    });
    const outcome = await processSubscriptionRun(
      { db, gateway, getNow: () => FIXED_NOW },
      run!,
    );
    expect(outcome.kind).toBe("failed");

    const [updatedRun] = await db
      .select()
      .from(subscriptionRuns)
      .where(eq(subscriptionRuns.id, run!.id));
    expect(updatedRun?.status).toBe("failed");
    expect(updatedRun?.failureReason).toBe("card_declined");

    const [updatedSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, sub.id));
    expect(updatedSub?.status).toBe("past_due");
    expect(updatedSub?.nextBillingDate).toBe("2026-05-15"); // NOT advanced

    expect(await db.select().from(orders)).toHaveLength(1); // only signup order
  });

  it("skips when sub has been paused since materialization (race condition)", async () => {
    const db = getDb();
    const c = await seedCustomer(db, {
      gatewayCustomerIds: { stub: "cus_test_3" } as unknown as { stripe?: string },
      defaultCardId: "pm_test_3",
    });
    const o = await seedOrder(db, c.id);
    const sub = await seedSub(db, c.id, o.id);
    await materializeDueSubscriptions(db, FIXED_NOW);
    const [run] = await db.select().from(subscriptionRuns);

    // Customer pauses between materializer and processor
    await db
      .update(subscriptions)
      .set({ status: "paused" })
      .where(eq(subscriptions.id, sub.id));

    const gateway = createStubGateway({ defaultRecurringOutcome: "succeeded" });
    const outcome = await processSubscriptionRun(
      { db, gateway, getNow: () => FIXED_NOW },
      run!,
    );
    expect(outcome.kind).toBe("skipped");

    const [updatedRun] = await db
      .select()
      .from(subscriptionRuns)
      .where(eq(subscriptionRuns.id, run!.id));
    expect(updatedRun?.status).toBe("abandoned");
    expect(await db.select().from(orders)).toHaveLength(1); // no charge
  });

  it("won't double-process: second processSubscriptionRun on the same row returns skipped", async () => {
    const db = getDb();
    const c = await seedCustomer(db, {
      gatewayCustomerIds: { stub: "cus_test_4" } as unknown as { stripe?: string },
      defaultCardId: "pm_test_4",
    });
    const o = await seedOrder(db, c.id);
    await seedSub(db, c.id, o.id);
    await materializeDueSubscriptions(db, FIXED_NOW);
    const [run] = await db.select().from(subscriptionRuns);

    const gateway = createStubGateway({ defaultRecurringOutcome: "succeeded" });
    const a = await processSubscriptionRun(
      { db, gateway, getNow: () => FIXED_NOW },
      run!,
    );
    const b = await processSubscriptionRun(
      { db, gateway, getNow: () => FIXED_NOW },
      run!,
    );
    expect(a.kind).toBe("succeeded");
    expect(b.kind).toBe("skipped");
    expect(await db.select().from(orders)).toHaveLength(2); // signup + ONE renewal
  });
});

describe("runSubscriptionCron — orchestrator", () => {
  const { getDb } = useTestDb();

  it("materializes + processes in one pass; reports counts", async () => {
    const db = getDb();
    // 2 due subs with PM saved (succeed), 1 due sub without PM (fails)
    const ok1 = await seedCustomer(db, {
      gatewayCustomerIds: { stub: "cus_a" } as unknown as { stripe?: string },
      defaultCardId: "pm_a",
    });
    const ok2 = await seedCustomer(db, {
      gatewayCustomerIds: { stub: "cus_b" } as unknown as { stripe?: string },
      defaultCardId: "pm_b",
    });
    const noPM = await seedCustomer(db);
    const o1 = await seedOrder(db, ok1.id);
    const o2 = await seedOrder(db, ok2.id);
    const o3 = await seedOrder(db, noPM.id);
    await seedSub(db, ok1.id, o1.id);
    await seedSub(db, ok2.id, o2.id, { productSlug: "energy" });
    await seedSub(db, noPM.id, o3.id, { productSlug: "glow" });
    // 1 due sub but customer paused yesterday (not picked up)
    const paused = await seedCustomer(db);
    const o4 = await seedOrder(db, paused.id);
    await seedSub(db, paused.id, o4.id, { status: "paused" });

    const gateway = createStubGateway({ defaultRecurringOutcome: "succeeded" });
    const report = await runSubscriptionCron({ db, gateway, now: FIXED_NOW });

    expect(report.materialize.subscriptionsConsidered).toBe(3);
    expect(report.materialize.runsCreated).toBe(3);
    expect(report.processed).toBe(3);
    expect(report.succeeded).toBe(2);
    expect(report.failed).toBe(1);
    expect(report.skipped).toBe(0);
  });

  it("respects maxRuns cap", async () => {
    const db = getDb();
    for (let i = 0; i < 5; i++) {
      const c = await seedCustomer(db, {
        gatewayCustomerIds: { stub: `cus_${i}` } as unknown as { stripe?: string },
        defaultCardId: `pm_${i}`,
      });
      const o = await seedOrder(db, c.id);
      await seedSub(db, c.id, o.id);
    }
    const gateway = createStubGateway({ defaultRecurringOutcome: "succeeded" });
    const report = await runSubscriptionCron({ db, gateway, now: FIXED_NOW, maxRuns: 2 });

    expect(report.materialize.runsCreated).toBe(5);
    expect(report.processed).toBe(2); // cap honored
    expect(report.succeeded).toBe(2);
  });
});
