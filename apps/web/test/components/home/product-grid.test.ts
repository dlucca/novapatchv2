/**
 * ProductGrid — smoke import + canonical-order tests (bun:test, no jsdom).
 *
 * Home grid is now a discovery surface — no add-to-cart button. Cards link to PDPs.
 *
 * Covers:
 *  - ProductGrid exports a function component (smoke import).
 *  - NOVA_PRODUCTS render in canonical order (energy, sleep, glow, shield, zen, woman).
 *  - "Popular" flag is present only on Glow.
 *  - The new module does NOT import the cart store (commerce moved to PDP/tienda).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "bun:test";
import { ProductGrid } from "@/components/home/product-grid";
import { NOVA_PRODUCTS, RETAIL_PRICE } from "@/lib/products";

describe("ProductGrid", () => {
  it("exports a function component", () => {
    expect(typeof ProductGrid).toBe("function");
  });

  it("NOVA_PRODUCTS appear in canonical order", () => {
    expect(NOVA_PRODUCTS.map((p) => p.slug)).toEqual([
      "energy",
      "sleep",
      "glow",
      "shield",
      "zen",
      "woman",
    ]);
  });

  it("Popular flag is present only on Glow", () => {
    const popular = NOVA_PRODUCTS.filter((p) => p.popular);
    expect(popular).toHaveLength(1);
    expect(popular[0]?.slug).toBe("glow");
  });

  it("does not import the cart store (home grid is discovery-only)", () => {
    const src = readFileSync(
      resolve(import.meta.dir, "../../../src/components/home/product-grid.tsx"),
      "utf8",
    );
    expect(src).not.toContain("cart-store");
    expect(src).not.toContain("useCart");
  });

  it("RETAIL_PRICE is 750", () => {
    expect(RETAIL_PRICE).toBe(750);
  });
});
