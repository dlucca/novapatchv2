import { describe, it, expect } from "bun:test";
import { useTestDb } from "../helpers/db";
import { customers } from "../../src/db/schema/customers";
import { orders } from "../../src/db/schema/orders";
import { paymentAttempts } from "../../src/db/schema/payment-attempts";

const SHIPPING = { line1: "X", city: "Y", state: "Z", postalCode: "00000", country: "MX" };

async function seedOrder(db: ReturnType<typeof useTestDb>["getDb"] extends () => infer T ? T : never) {
  const [c] = await db.insert(customers).values({ clerkUserId: "u_pcu", email: "p@p.com" }).returning();
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
  return o!.id;
}

describe("payment_attempts (provider, providerChargeId) partial unique", () => {
  const { getDb } = useTestDb();

  it("rejects two attempts with the same (provider, providerChargeId)", async () => {
    const db = getDb();
    const orderId = await seedOrder(db);
    await db.insert(paymentAttempts).values({
      orderId,
      provider: "stripe",
      providerChargeId: "ch_dup",
      amount: 1000,
      currency: "MXN",
      status: "succeeded",
    });
    await expect(
      Promise.resolve(
        db.insert(paymentAttempts).values({
          orderId,
          provider: "stripe",
          providerChargeId: "ch_dup",
          amount: 1000,
          currency: "MXN",
          status: "succeeded",
        }),
      ),
    ).rejects.toThrow(/payment_attempts_provider_charge_unique/);
  });

  it("allows two attempts with the same provider but null providerChargeId", async () => {
    const db = getDb();
    const orderId = await seedOrder(db);
    await db.insert(paymentAttempts).values({
      orderId,
      provider: "stripe",
      amount: 1000,
      currency: "MXN",
      status: "pending",
    });
    await db.insert(paymentAttempts).values({
      orderId,
      provider: "stripe",
      amount: 1000,
      currency: "MXN",
      status: "pending",
    });
    const rows = await db.select().from(paymentAttempts);
    expect(rows.length).toBe(2);
  });

  it("allows same providerChargeId across different providers", async () => {
    const db = getDb();
    const orderId = await seedOrder(db);
    await db.insert(paymentAttempts).values({
      orderId,
      provider: "stripe",
      providerChargeId: "shared_id",
      amount: 1000,
      currency: "MXN",
      status: "succeeded",
    });
    await db.insert(paymentAttempts).values({
      orderId,
      provider: "mercadopago",
      providerChargeId: "shared_id",
      amount: 1000,
      currency: "MXN",
      status: "succeeded",
    });
    const rows = await db.select().from(paymentAttempts);
    expect(rows.length).toBe(2);
  });
});
