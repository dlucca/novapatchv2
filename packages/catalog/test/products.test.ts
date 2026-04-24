import { describe, it, expect } from "bun:test";
import { PRODUCTS, DISPLAY_ORDER, getProduct, listProducts } from "../src/index";
import { isProductSlug } from "../src/index";

describe("PRODUCTS", () => {
  it("contains exactly the 6 launch SKUs", () => {
    expect(Object.keys(PRODUCTS).sort()).toEqual(
      ["energy", "glow", "shield", "sleep", "woman", "zen"],
    );
  });

  it("every product has base prices for all 5 markets", () => {
    for (const product of Object.values(PRODUCTS)) {
      expect(Object.keys(product.basePrice).sort()).toEqual(
        ["ar", "br", "cl", "co", "mx"],
      );
      for (const price of Object.values(product.basePrice)) {
        expect(Number.isInteger(price)).toBe(true);
        expect(price).toBeGreaterThan(0);
      }
    }
  });

  it("every product has subscription discounts for 30/60/90", () => {
    for (const product of Object.values(PRODUCTS)) {
      expect(product.subscriptionDiscounts).toEqual({ 30: 20, 60: 15, 90: 10 });
    }
  });
});

describe("DISPLAY_ORDER", () => {
  it("is the canonical 6-product order", () => {
    expect(DISPLAY_ORDER).toEqual([
      "energy", "sleep", "glow", "shield", "zen", "woman",
    ]);
  });
});

describe("getProduct", () => {
  it("returns product for known slug", () => {
    expect(getProduct("energy")?.name).toBe("Energy");
  });

  it("returns undefined for unknown slug", () => {
    expect(getProduct("nope")).toBeUndefined();
  });
});

describe("listProducts", () => {
  it("returns all products in DISPLAY_ORDER", () => {
    const slugs = listProducts().map((p) => p.slug);
    expect(slugs).toEqual([...DISPLAY_ORDER]);
  });
});

describe("isProductSlug", () => {
  it("returns true for all 6 launch SKUs", () => {
    for (const slug of ["energy", "sleep", "glow", "shield", "zen", "woman"]) {
      expect(isProductSlug(slug)).toBe(true);
    }
  });

  it("returns false for unknown slugs", () => {
    expect(isProductSlug("nope")).toBe(false);
    expect(isProductSlug("")).toBe(false);
    expect(isProductSlug("Energy")).toBe(false); // case-sensitive
  });

  it("returns false for non-strings", () => {
    expect(isProductSlug(null)).toBe(false);
    expect(isProductSlug(undefined)).toBe(false);
    expect(isProductSlug(42)).toBe(false);
  });
});
