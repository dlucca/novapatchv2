import { describe, it, expect } from "bun:test";
import { useTestDb } from "../helpers/db";
import { discountCodes, discountRedemptions } from "../../src/db/schema/discounts";
import { customers } from "../../src/db/schema/customers";
import { orders } from "../../src/db/schema/orders";

describe("discount unique indexes", () => {
  const { getDb } = useTestDb();

  it("rejects two codes that differ only in case", async () => {
    const db = getDb();
    await db.insert(discountCodes).values({
      code: "welcome10",
      kind: "promo",
      discountPct: 10,
      markets: ["mx"],
      appliesTo: "all",
    });
    // Drizzle insert builders are thenables, not native Promises. bun:test's
    // expect(...).rejects only recognizes native Promises, so wrap with
    // Promise.resolve() to force one. Apply this pattern in every DB
    // constraint-violation assertion.
    await expect(
      Promise.resolve(
        db.insert(discountCodes).values({
          code: "WELCOME10",
          kind: "promo",
          discountPct: 10,
          markets: ["mx"],
          appliesTo: "all",
        }),
      ),
    ).rejects.toThrow(/discount_codes_lower_code_unique/);
  });

  it("rejects a second redemption for the same (code, customer, order) tuple", async () => {
    const db = getDb();
    const [code] = await db
      .insert(discountCodes)
      .values({
        code: "dup-guard",
        kind: "promo",
        discountPct: 10,
        markets: ["mx"],
        appliesTo: "all",
      })
      .returning();
    const [customer] = await db
      .insert(customers)
      .values({ clerkUserId: "user_dup", email: "dup@example.com" })
      .returning();
    const [order] = await db
      .insert(orders)
      .values({
        customerId: customer!.id,
        market: "mx",
        currency: "MXN",
        subtotal: 45000,
        tax: 7200,
        shipping: 8500,
        discountAmount: 0,
        total: 60700,
        status: "pending",
        paymentProvider: "openpay",
        shippingAddress: {},
      })
      .returning();

    await db.insert(discountRedemptions).values({
      discountCodeId: code!.id,
      customerId: customer!.id,
      orderId: order!.id,
      discountAmount: 4500,
    });

    await expect(
      Promise.resolve(
        db.insert(discountRedemptions).values({
          discountCodeId: code!.id,
          customerId: customer!.id,
          orderId: order!.id,
          discountAmount: 4500,
        }),
      ),
    ).rejects.toThrow(/discount_redemptions_code_customer_order_unique/);
  });
});
