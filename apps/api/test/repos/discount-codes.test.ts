import { describe, it, expect } from "bun:test";
import { useTestDb } from "../helpers/db";
import type { Db } from "../../src/db";
import { discountCodes, discountRedemptions } from "../../src/db/schema/discounts";
import { customers } from "../../src/db/schema/customers";
import { orders } from "../../src/db/schema/orders";
import {
  findActiveByCode,
  countRedemptionsByCustomer,
} from "../../src/repos/discount-codes";

const NOW = new Date("2026-06-01T12:00:00Z");

async function insertCode(
  db: Db,
  overrides: Partial<typeof discountCodes.$inferInsert> = {},
) {
  const [row] = await db.insert(discountCodes).values({
    code: "welcome10",
    kind: "promo",
    discountPct: 10,
    markets: ["mx"],
    appliesTo: "all",
    status: "active",
    ...overrides,
  }).returning();
  return row!;
}

describe("discount-codes repo — findActiveByCode", () => {
  const { getDb } = useTestDb();

  it("matches case-insensitively", async () => {
    const db = getDb();
    await insertCode(db, { code: "welcome10" });
    const found = await findActiveByCode(db, { code: "WELCOME10", market: "mx", now: NOW });
    expect(found?.code).toBe("welcome10");
  });

  it("returns undefined when code is disabled", async () => {
    const db = getDb();
    await insertCode(db, { code: "disabled", status: "disabled" });
    const found = await findActiveByCode(db, { code: "disabled", market: "mx", now: NOW });
    expect(found).toBeUndefined();
  });

  it("returns undefined when code has expired", async () => {
    const db = getDb();
    await insertCode(db, { code: "expired", validUntil: new Date("2026-01-01T00:00:00Z") });
    const found = await findActiveByCode(db, { code: "expired", market: "mx", now: NOW });
    expect(found).toBeUndefined();
  });

  it("returns undefined when code has not yet started", async () => {
    const db = getDb();
    await insertCode(db, { code: "future", validFrom: new Date("2027-01-01T00:00:00Z") });
    const found = await findActiveByCode(db, { code: "future", market: "mx", now: NOW });
    expect(found).toBeUndefined();
  });

  it("returns undefined when code is not valid in the requested market", async () => {
    const db = getDb();
    await insertCode(db, { code: "mxonly", markets: ["mx"] });
    const found = await findActiveByCode(db, { code: "mxonly", market: "br", now: NOW });
    expect(found).toBeUndefined();
  });

  it("returns the code when it's active, within window, and market matches", async () => {
    const db = getDb();
    await insertCode(db, {
      code: "happy",
      validFrom: new Date("2026-01-01T00:00:00Z"),
      validUntil: new Date("2027-01-01T00:00:00Z"),
      markets: ["mx", "br"],
    });
    const found = await findActiveByCode(db, { code: "happy", market: "br", now: NOW });
    expect(found?.code).toBe("happy");
  });
});

describe("discount-codes repo — countRedemptionsByCustomer", () => {
  const { getDb } = useTestDb();

  it("returns 0 when there are no redemptions", async () => {
    const db = getDb();
    const code = await insertCode(db, { code: "never-used" });
    const [c] = await db.insert(customers).values({ clerkUserId: "u1", email: "u1@example.com" }).returning();
    const n = await countRedemptionsByCustomer(db, {
      discountCodeId: code.id,
      customerId: c!.id,
    });
    expect(n).toBe(0);
  });

  it("counts only redemptions for the matching (code, customer) pair", async () => {
    const db = getDb();
    const code = await insertCode(db, { code: "usedtwice" });
    const otherCode = await insertCode(db, { code: "othercode" });
    const [alice] = await db.insert(customers).values({ clerkUserId: "u_alice", email: "a@example.com" }).returning();
    const [bob] = await db.insert(customers).values({ clerkUserId: "u_bob", email: "b@example.com" }).returning();

    async function insertOrderFor(customerId: string) {
      const [order] = await db
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
          status: "pending",
          paymentProvider: "openpay",
          shippingAddress: {},
        })
        .returning();
      return order!.id;
    }

    const aliceOrder1 = await insertOrderFor(alice!.id);
    const aliceOrder2 = await insertOrderFor(alice!.id);
    const bobOrder = await insertOrderFor(bob!.id);

    await db.insert(discountRedemptions).values([
      { discountCodeId: code.id, customerId: alice!.id, orderId: aliceOrder1, discountAmount: 4500 },
      { discountCodeId: code.id, customerId: alice!.id, orderId: aliceOrder2, discountAmount: 4500 },
      { discountCodeId: otherCode.id, customerId: alice!.id, orderId: aliceOrder1, discountAmount: 4500 },
      { discountCodeId: code.id, customerId: bob!.id, orderId: bobOrder, discountAmount: 4500 },
    ]);

    const n = await countRedemptionsByCustomer(db, {
      discountCodeId: code.id,
      customerId: alice!.id,
    });
    expect(n).toBe(2);
  });
});
