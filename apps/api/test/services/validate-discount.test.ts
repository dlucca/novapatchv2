import { describe, it, expect } from "bun:test";
import { validateDiscount } from "../../src/services/validate-discount";
import type { DiscountCode } from "../../src/db/schema/discounts";

const baseCode: DiscountCode = {
  id: "00000000-0000-0000-0000-000000000001",
  code: "welcome10",
  kind: "promo",
  influencerId: null,
  discountPct: 10,
  markets: ["mx"],
  appliesTo: "all",
  minSubtotal: null,
  maxUses: null,
  maxUsesPerCustomer: null,
  timesUsed: 0,
  validFrom: null,
  validUntil: null,
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("validateDiscount", () => {
  it("returns not_found when the repo returns undefined", async () => {
    const result = await validateDiscount({
      code: "bogus",
      market: "mx",
      subtotal: 45000,
      now: new Date(),
      findActiveByCode: async () => undefined,
      countRedemptionsByCustomer: async () => 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("discount_not_found");
  });

  it("returns below_minimum when subtotal < min_subtotal", async () => {
    const result = await validateDiscount({
      code: "welcome10",
      market: "mx",
      subtotal: 40000,
      now: new Date(),
      findActiveByCode: async () => ({ ...baseCode, minSubtotal: 50000 }),
      countRedemptionsByCustomer: async () => 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("discount_below_minimum");
  });

  it("returns max_uses_reached when times_used >= max_uses", async () => {
    const result = await validateDiscount({
      code: "welcome10",
      market: "mx",
      subtotal: 45000,
      now: new Date(),
      findActiveByCode: async () => ({ ...baseCode, maxUses: 100, timesUsed: 100 }),
      countRedemptionsByCustomer: async () => 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("discount_max_uses_reached");
  });

  it("skips the per-customer check when customerId is absent", async () => {
    const result = await validateDiscount({
      code: "welcome10",
      market: "mx",
      subtotal: 45000,
      now: new Date(),
      findActiveByCode: async () => ({ ...baseCode, maxUsesPerCustomer: 1 }),
      countRedemptionsByCustomer: async () => 999,
    });
    expect(result.ok).toBe(true);
  });

  it("returns max_per_customer_reached when customer cap hit", async () => {
    const result = await validateDiscount({
      code: "welcome10",
      market: "mx",
      subtotal: 45000,
      customerId: "11111111-1111-1111-1111-111111111111",
      now: new Date(),
      findActiveByCode: async () => ({ ...baseCode, maxUsesPerCustomer: 1 }),
      countRedemptionsByCustomer: async () => 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("discount_max_per_customer_reached");
  });

  it("returns ok with the normalized discount on success", async () => {
    const result = await validateDiscount({
      code: "welcome10",
      market: "mx",
      subtotal: 45000,
      now: new Date(),
      findActiveByCode: async () => baseCode,
      countRedemptionsByCustomer: async () => 0,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.discount).toEqual({
        code: "welcome10",
        discountPct: 10,
        appliesTo: "all",
      });
      expect(result.discountCodeId).toBe(baseCode.id);
    }
  });
});
