import { describe, it, expect } from "bun:test";
import { eq } from "drizzle-orm";
import { useTestDb } from "../helpers/db";
import { customers } from "../../src/db/schema/customers";
import { discountCodes, discountRedemptions } from "../../src/db/schema/discounts";
import { orders, orderItems } from "../../src/db/schema/orders";
import { subscriptions } from "../../src/db/schema/subscriptions";
import {
  persistOrder,
  findOrderByIdempotencyKey,
} from "../../src/repos/orders";

function baseOrder(customerId: string, idempotencyKey: string, overrides = {}) {
  return {
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
    paymentChargeId: "stub_abc",
    shippingAddress: {},
    idempotencyKey,
    ...overrides,
  };
}

describe("persistOrder", () => {
  const { getDb } = useTestDb();

  it("inserts the order + items atomically and returns orderId", async () => {
    const db = getDb();
    const [c] = await db.insert(customers).values({ clerkUserId: "u1", email: "u1@example.com" }).returning();
    const res = await persistOrder(db, {
      order: baseOrder(c!.id, "ik-1"),
      orderItems: [
        {
          productSlug: "energy",
          name: "Energy",
          unitPrice: 45000,
          quantity: 1,
          isSubscription: false,
        },
      ],
      subscriptions: [],
    });

    expect(res.orderId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(res.subscriptionIds).toEqual([]);

    const savedOrder = await db.select().from(orders).where(eq(orders.id, res.orderId));
    expect(savedOrder[0]?.idempotencyKey).toBe("ik-1");
    const savedItems = await db.select().from(orderItems).where(eq(orderItems.orderId, res.orderId));
    expect(savedItems).toHaveLength(1);
  });

  it("inserts subscriptions with originalOrderId wired from the inserted order", async () => {
    const db = getDb();
    const [c] = await db.insert(customers).values({ clerkUserId: "u2", email: "u2@example.com" }).returning();
    const res = await persistOrder(db, {
      order: baseOrder(c!.id, "ik-2"),
      orderItems: [
        { productSlug: "sleep", name: "Sleep", unitPrice: 36000, quantity: 1, isSubscription: true, intervalDays: 30, discountPct: 20 },
      ],
      subscriptions: [
        {
          customerId: c!.id,
          productSlug: "sleep",
          intervalDays: 30,
          unitPrice: 36000,
          quantity: 1,
          market: "mx",
          currency: "MXN",
          status: "active",
          nextBillingDate: "2026-05-31",
          shippingAddress: {},
        },
      ],
    });

    expect(res.subscriptionIds).toHaveLength(1);
    const saved = await db.select().from(subscriptions).where(eq(subscriptions.id, res.subscriptionIds[0]!));
    expect(saved[0]?.originalOrderId).toBe(res.orderId);
    expect(saved[0]?.nextBillingDate).toBe("2026-05-31");
  });

  it("inserts redemption + increments discount_codes.times_used atomically", async () => {
    const db = getDb();
    const [c] = await db.insert(customers).values({ clerkUserId: "u3", email: "u3@example.com" }).returning();
    const [code] = await db
      .insert(discountCodes)
      .values({
        code: "welcome10",
        kind: "promo",
        discountPct: 10,
        markets: ["mx"],
        appliesTo: "all",
        status: "active",
      })
      .returning();

    const res = await persistOrder(db, {
      order: baseOrder(c!.id, "ik-3", { discountCodeId: code!.id, discountAmount: 4500 }),
      orderItems: [
        { productSlug: "energy", name: "Energy", unitPrice: 45000, quantity: 1, isSubscription: false },
      ],
      subscriptions: [],
      redemption: {
        discountCodeId: code!.id,
        customerId: c!.id,
        discountAmount: 4500,
        influencerId: null,
        commissionAmount: null,
      },
    });

    const savedRedemption = await db
      .select()
      .from(discountRedemptions)
      .where(eq(discountRedemptions.orderId, res.orderId));
    expect(savedRedemption).toHaveLength(1);
    const refreshedCode = await db.select().from(discountCodes).where(eq(discountCodes.id, code!.id));
    expect(refreshedCode[0]?.timesUsed).toBe(1);
  });

  it("rolls back everything if any insert fails", async () => {
    const db = getDb();
    const [c] = await db.insert(customers).values({ clerkUserId: "u4", email: "u4@example.com" }).returning();
    await expect(
      persistOrder(db, {
        order: baseOrder(c!.id, "ik-4"),
        orderItems: [
          { productSlug: "energy", name: "Energy", unitPrice: 45000, quantity: 1, isSubscription: false },
        ],
        subscriptions: [
          {
            customerId: "00000000-0000-0000-0000-000000000000", // FK violation
            productSlug: "sleep",
            intervalDays: 30,
            unitPrice: 36000,
            quantity: 1,
            market: "mx",
            currency: "MXN",
            status: "active",
            nextBillingDate: "2026-05-31",
            shippingAddress: {},
          },
        ],
      }),
    ).rejects.toThrow();

    const allOrders = await db.select().from(orders);
    const allItems = await db.select().from(orderItems);
    const allSubs = await db.select().from(subscriptions);
    expect(allOrders).toHaveLength(0);
    expect(allItems).toHaveLength(0);
    expect(allSubs).toHaveLength(0);
  });
});

describe("findOrderByIdempotencyKey", () => {
  const { getDb } = useTestDb();

  it("returns undefined for unknown key", async () => {
    const db = getDb();
    const r = await findOrderByIdempotencyKey(db, "ik-missing");
    expect(r).toBeUndefined();
  });

  it("returns the order + items + subscriptions for a known key", async () => {
    const db = getDb();
    const [c] = await db.insert(customers).values({ clerkUserId: "u5", email: "u5@example.com" }).returning();
    const persisted = await persistOrder(db, {
      order: baseOrder(c!.id, "ik-lookup"),
      orderItems: [
        { productSlug: "sleep", name: "Sleep", unitPrice: 36000, quantity: 1, isSubscription: true, intervalDays: 30, discountPct: 20 },
      ],
      subscriptions: [
        {
          customerId: c!.id,
          productSlug: "sleep",
          intervalDays: 30,
          unitPrice: 36000,
          quantity: 1,
          market: "mx",
          currency: "MXN",
          status: "active",
          nextBillingDate: "2026-05-31",
          shippingAddress: {},
        },
      ],
    });
    const r = await findOrderByIdempotencyKey(db, "ik-lookup");
    expect(r?.order.id).toBe(persisted.orderId);
    expect(r?.items).toHaveLength(1);
    expect(r?.subscriptions).toHaveLength(1);
  });
});
