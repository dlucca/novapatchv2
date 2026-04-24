import { describe, it, expect } from "bun:test";
import { useTestDb } from "../helpers/db";
import { orders } from "../../src/db/schema/orders";
import { customers } from "../../src/db/schema/customers";

function orderFixture(customerId: string, overrides: Partial<typeof orders.$inferInsert> = {}) {
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
    shippingAddress: {},
    ...overrides,
  };
}

describe("orders.idempotency_key unique index", () => {
  const { getDb } = useTestDb();

  it("allows multiple rows with NULL idempotency_key", async () => {
    const db = getDb();
    const [c] = await db.insert(customers).values({ clerkUserId: "u_n", email: "n@example.com" }).returning();
    await db.insert(orders).values(orderFixture(c!.id));
    await db.insert(orders).values(orderFixture(c!.id));
    const rows = await db.select().from(orders);
    expect(rows.length).toBe(2);
  });

  it("rejects two rows sharing the same non-null idempotency_key", async () => {
    const db = getDb();
    const [c] = await db.insert(customers).values({ clerkUserId: "u_d", email: "d@example.com" }).returning();
    await db.insert(orders).values(orderFixture(c!.id, { idempotencyKey: "key-1" }));
    // Drizzle insert builders are thenables, not native Promises. bun:test's
    // expect(...).rejects only recognizes native Promises, so wrap with
    // Promise.resolve() to force one.
    await expect(
      Promise.resolve(db.insert(orders).values(orderFixture(c!.id, { idempotencyKey: "key-1" }))),
    ).rejects.toThrow(/orders_idempotency_key_unique/);
  });

  it("allows the same idempotency_key after the first row is deleted", async () => {
    const db = getDb();
    const [c] = await db.insert(customers).values({ clerkUserId: "u_r", email: "r@example.com" }).returning();
    const [first] = await db
      .insert(orders)
      .values(orderFixture(c!.id, { idempotencyKey: "key-reuse" }))
      .returning();
    const { eq } = await import("drizzle-orm");
    await db.delete(orders).where(eq(orders.id, first!.id));
    await db.insert(orders).values(orderFixture(c!.id, { idempotencyKey: "key-reuse" }));
    const rows = await db.select().from(orders);
    expect(rows.length).toBe(1);
  });
});
