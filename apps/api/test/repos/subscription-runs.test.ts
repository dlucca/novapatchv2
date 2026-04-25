import { describe, it, expect } from "bun:test";
import { useTestDb } from "../helpers/db";
import { customers } from "../../src/db/schema/customers";
import { orders } from "../../src/db/schema/orders";
import { subscriptions } from "../../src/db/schema/subscriptions";
import { subscriptionRuns } from "../../src/db/schema/subscription-runs";
import { eq } from "drizzle-orm";
import {
  materializeRun,
  getNextRunsForProcessing,
  markStatus,
} from "../../src/repos/subscription-runs";

const SHIPPING = { line1: "X", city: "Y", state: "Z", postalCode: "00000", country: "MX" };

async function seedSub(db: ReturnType<typeof useTestDb>["getDb"] extends () => infer T ? T : never) {
  const [c] = await db.insert(customers).values({ clerkUserId: "u_sr", email: "s@s.com" }).returning();
  const [o] = await db
    .insert(orders)
    .values({
      customerId: c!.id,
      market: "mx",
      currency: "MXN",
      subtotal: 1000,
      tax: 160,
      shipping: 0,
      total: 1160,
      discountAmount: 0,
      status: "paid",
      paymentProvider: "stub",
      shippingAddress: SHIPPING,
    })
    .returning();
  const [s] = await db
    .insert(subscriptions)
    .values({
      customerId: c!.id,
      originalOrderId: o!.id,
      productSlug: "energy",
      intervalDays: 30,
      unitPrice: 1000,
      quantity: 1,
      market: "mx",
      currency: "MXN",
      status: "active",
      nextBillingDate: "2026-05-25",
      shippingAddress: SHIPPING,
    })
    .returning();
  return { subId: s!.id, orderId: o!.id };
}

describe("materializeRun", () => {
  const { getDb } = useTestDb();

  it("inserts a new run on first call", async () => {
    const db = getDb();
    const { subId } = await seedSub(db);
    const result = await materializeRun(db, {
      subscriptionId: subId,
      cycleNumber: 1,
      scheduledFor: new Date("2026-05-25T10:00:00Z"),
    });
    expect(result.inserted).toBe(true);
    expect(result.id).toBeTruthy();
  });

  it("is idempotent: same (subscriptionId, scheduledFor) returns inserted:false", async () => {
    const db = getDb();
    const { subId } = await seedSub(db);
    const when = new Date("2026-05-25T10:00:00Z");
    const first = await materializeRun(db, {
      subscriptionId: subId,
      cycleNumber: 1,
      scheduledFor: when,
    });
    const second = await materializeRun(db, {
      subscriptionId: subId,
      cycleNumber: 1,
      scheduledFor: when,
    });
    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
    expect(second.id).toBe(first.id);
    const rows = await db.select().from(subscriptionRuns);
    expect(rows.length).toBe(1);
  });
});

describe("getNextRunsForProcessing", () => {
  const { getDb } = useTestDb();

  it("returns only pending runs whose scheduledFor is <= now, ordered ascending", async () => {
    const db = getDb();
    const { subId } = await seedSub(db);
    const now = new Date("2026-05-25T10:00:00Z");

    // Three pending runs at different times relative to `now`.
    await materializeRun(db, { subscriptionId: subId, cycleNumber: 1, scheduledFor: new Date("2026-05-24T10:00:00Z") });
    await materializeRun(db, { subscriptionId: subId, cycleNumber: 2, scheduledFor: new Date("2026-05-25T09:00:00Z") });
    await materializeRun(db, { subscriptionId: subId, cycleNumber: 3, scheduledFor: new Date("2026-05-26T10:00:00Z") });

    const due = await getNextRunsForProcessing(db, { now, limit: 50 });
    expect(due).toHaveLength(2);
    expect(due[0]?.cycleNumber).toBe(1);
    expect(due[1]?.cycleNumber).toBe(2);
  });

  it("excludes runs that are not in 'pending' status", async () => {
    const db = getDb();
    const { subId } = await seedSub(db);
    const now = new Date("2026-05-25T10:00:00Z");
    const r1 = await materializeRun(db, { subscriptionId: subId, cycleNumber: 1, scheduledFor: new Date("2026-05-24T10:00:00Z") });
    await markStatus(db, { id: r1.id, status: "succeeded" });
    const due = await getNextRunsForProcessing(db, { now, limit: 50 });
    expect(due).toHaveLength(0);
  });
});

describe("markStatus", () => {
  const { getDb } = useTestDb();

  it("updates the row's status and optional fields", async () => {
    const db = getDb();
    const { subId, orderId } = await seedSub(db);
    const r = await materializeRun(db, {
      subscriptionId: subId,
      cycleNumber: 1,
      scheduledFor: new Date("2026-05-25T10:00:00Z"),
    });
    await markStatus(db, {
      id: r.id,
      status: "succeeded",
      orderId,
      finishedAt: new Date("2026-05-25T10:00:05Z"),
      attemptCount: 1,
    });
    const [row] = await db.select().from(subscriptionRuns).where(eq(subscriptionRuns.id, r.id));
    expect(row?.status).toBe("succeeded");
    expect(row?.orderId).toBe(orderId);
    expect(row?.attemptCount).toBe(1);
    expect(row?.finishedAt).toBeTruthy();
  });
});
