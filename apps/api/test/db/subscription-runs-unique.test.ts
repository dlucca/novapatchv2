import { describe, it, expect } from "bun:test";
import { useTestDb } from "../helpers/db";
import { customers } from "../../src/db/schema/customers";
import { orders } from "../../src/db/schema/orders";
import { subscriptions } from "../../src/db/schema/subscriptions";
import { subscriptionRuns } from "../../src/db/schema/subscription-runs";

const SHIPPING = { line1: "X", city: "Y", state: "Z", postalCode: "00000", country: "MX" };

async function seedSub(db: ReturnType<typeof useTestDb>["getDb"] extends () => infer T ? T : never) {
  const [c] = await db.insert(customers).values({ clerkUserId: "u_sru", email: "s@s.com" }).returning();
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
  return s!.id;
}

describe("subscription_runs UNIQUE(subscriptionId, scheduledFor)", () => {
  const { getDb } = useTestDb();

  it("rejects two runs with the same (subscriptionId, scheduledFor)", async () => {
    const db = getDb();
    const subId = await seedSub(db);
    const when = new Date("2026-05-25T10:00:00Z");
    await db.insert(subscriptionRuns).values({ subscriptionId: subId, cycleNumber: 1, scheduledFor: when });
    await expect(
      Promise.resolve(
        db.insert(subscriptionRuns).values({ subscriptionId: subId, cycleNumber: 2, scheduledFor: when }),
      ),
    ).rejects.toThrow(/subscription_runs_sub_scheduled_unique/);
  });

  it("allows two runs with the same subscription but different scheduledFor", async () => {
    const db = getDb();
    const subId = await seedSub(db);
    await db.insert(subscriptionRuns).values({
      subscriptionId: subId,
      cycleNumber: 1,
      scheduledFor: new Date("2026-05-25T10:00:00Z"),
    });
    await db.insert(subscriptionRuns).values({
      subscriptionId: subId,
      cycleNumber: 2,
      scheduledFor: new Date("2026-06-24T10:00:00Z"),
    });
    const rows = await db.select().from(subscriptionRuns);
    expect(rows.length).toBe(2);
  });
});
