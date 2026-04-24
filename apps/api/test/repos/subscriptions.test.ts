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
