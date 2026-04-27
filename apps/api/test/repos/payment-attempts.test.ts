import { describe, it, expect } from "bun:test";
import { useTestDb } from "../helpers/db";
import { customers } from "../../src/db/schema/customers";
import { orders } from "../../src/db/schema/orders";
import { subscriptions } from "../../src/db/schema/subscriptions";
import { subscriptionRuns } from "../../src/db/schema/subscription-runs";
import { recordAttempt, findByProviderChargeId } from "../../src/repos/payment-attempts";

const SHIPPING = { line1: "X", city: "Y", state: "Z", postalCode: "00000", country: "MX" };

async function seedOrderAndRun(db: ReturnType<typeof useTestDb>["getDb"] extends () => infer T ? T : never) {
  const [c] = await db.insert(customers).values({ clerkUserId: "u_pa", email: "p@p.com" }).returning();
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

describe("recordAttempt", () => {
  const { getDb } = useTestDb();

  it("inserts an attempt for an order and returns its id", async () => {
    const db = getDb();
    const { orderId } = await seedOrderAndRun(db);
    const { id } = await recordAttempt(db, {
      orderId,
      provider: "stripe",
      providerChargeId: "ch_1",
      providerCustomerId: "cus_1",
      amount: 1160,
      currency: "MXN",
      status: "succeeded",
      providerResponse: { foo: "bar" },
    });
    expect(id).toBeTruthy();
  });

  it("inserts an attempt for a subscription run and returns its id", async () => {
    const db = getDb();
    const { runId } = await seedOrderAndRun(db);
    const { id } = await recordAttempt(db, {
      subscriptionRunId: runId,
      provider: "stripe",
      providerChargeId: "ch_2",
      amount: 1000,
      currency: "MXN",
      status: "succeeded",
    });
    expect(id).toBeTruthy();
  });
});

describe("findByProviderChargeId", () => {
  const { getDb } = useTestDb();

  it("returns the row when (provider, providerChargeId) matches", async () => {
    const db = getDb();
    const { orderId } = await seedOrderAndRun(db);
    await recordAttempt(db, {
      orderId,
      provider: "stripe",
      providerChargeId: "ch_lookup",
      amount: 1160,
      currency: "MXN",
      status: "succeeded",
    });
    const found = await findByProviderChargeId(db, {
      provider: "stripe",
      providerChargeId: "ch_lookup",
    });
    expect(found?.orderId).toBe(orderId);
    expect(found?.amount).toBe(1160);
  });

  it("returns null when no row matches", async () => {
    const db = getDb();
    const found = await findByProviderChargeId(db, {
      provider: "stripe",
      providerChargeId: "nope",
    });
    expect(found).toBeNull();
  });
});
