import { describe, it, expect } from "bun:test";
import { getPriceForMarket, getSubscriptionPrice } from "../src/pricing";
import { PRODUCTS } from "../src/products";
import type { Product } from "../src/types";

describe("getPriceForMarket", () => {
  it("returns base price for a given market", () => {
    expect(getPriceForMarket(PRODUCTS.energy, "mx")).toBe(75000);
  });

  it("throws for unknown market", () => {
    // @ts-expect-error — runtime test of invariant
    expect(() => getPriceForMarket(PRODUCTS.energy, "us")).toThrow(/no price/i);
  });
});

describe("getSubscriptionPrice", () => {
  it("applies 15% off for 30-day interval in MX", () => {
    expect(getSubscriptionPrice(PRODUCTS.energy, "mx", 30)).toBe(63750);
  });

  it("applies 10% off for 60-day interval in MX", () => {
    expect(getSubscriptionPrice(PRODUCTS.energy, "mx", 60)).toBe(67500);
  });

  it("applies 5% off for 90-day interval in MX", () => {
    expect(getSubscriptionPrice(PRODUCTS.energy, "mx", 90)).toBe(71250);
  });

  it("rounds half-cent results to nearest integer cent", () => {
    // Synthetic: 4501 * 85 / 100 = 3825.85 → rounds to 3826
    const synthetic: Product = {
      ...PRODUCTS.energy,
      basePrice: { ...PRODUCTS.energy.basePrice, mx: 4501 },
    };
    expect(getSubscriptionPrice(synthetic, "mx", 30)).toBe(3826);
  });
});
