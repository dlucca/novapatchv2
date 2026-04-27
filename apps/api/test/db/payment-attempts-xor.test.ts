import { describe, it, expect } from "bun:test";
import { useTestDb } from "../helpers/db";
import { customers } from "../../src/db/schema/customers";
import { orders } from "../../src/db/schema/orders";
import { subscriptions } from "../../src/db/schema/subscriptions";
import { subscriptionRuns } from "../../src/db/schema/subscription-runs";
import { paymentAttempts } from "../../src/db/schema/payment-attempts";

const SHIPPING = { line1: "X", city: "Y", state: "Z", postalCode: "00000", country: "MX" };

async function seedOrderAndRun(db: ReturnType<typeof useTestDb>["getDb"] extends () => infer T ? T : never) {
  const [c] = await db.insert(customers).values({ clerkUserId: "u_xor", email: "x@x.com" }).returning();
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
  const [r] = await db
    .insert(subscriptionRuns)
    .values({ subscriptionId: s!.id, cycleNumber: 1, scheduledFor: new Date() })
    .returning();
  return { orderId: o!.id, runId: r!.id };
}

describe("payment_attempts XOR check", () => {
  const { getDb } = useTestDb();

  it("succeeds with only orderId set", async () => {
    const db = getDb();
    const { orderId } = await seedOrderAndRun(db);
    await db.insert(paymentAttempts).values({
      orderId,
      provider: "stub",
      amount: 1000,
      currency: "MXN",
      status: "succeeded",
    });
    const rows = await db.select().from(paymentAttempts);
    expect(rows.length).toBe(1);
  });

  it("succeeds with only subscriptionRunId set", async () => {
    const db = getDb();
    const { runId } = await seedOrderAndRun(db);
    await db.insert(paymentAttempts).values({
      subscriptionRunId: runId,
      provider: "stub",
      amount: 1000,
      currency: "MXN",
      status: "succeeded",
    });
    const rows = await db.select().from(paymentAttempts);
    expect(rows.length).toBe(1);
  });

  it("rejects when both orderId and subscriptionRunId are set", async () => {
    const db = getDb();
    const { orderId, runId } = await seedOrderAndRun(db);
    await expect(
      Promise.resolve(
        db.insert(paymentAttempts).values({
          orderId,
          subscriptionRunId: runId,
          provider: "stub",
          amount: 1000,
          currency: "MXN",
          status: "succeeded",
        }),
      ),
    ).rejects.toThrow(/payment_attempts_parent_xor/);
  });

  it("rejects when neither parent is set", async () => {
    const db = getDb();
    await seedOrderAndRun(db); // not used; just ensures DB is alive
    await expect(
      Promise.resolve(
        db.insert(paymentAttempts).values({
          provider: "stub",
          amount: 1000,
          currency: "MXN",
          status: "succeeded",
        }),
      ),
    ).rejects.toThrow(/payment_attempts_parent_xor/);
  });
});
