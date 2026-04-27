import { describe, expect, it } from "bun:test";
import { getProductContent, PRODUCTS_CONTENT } from "@/lib/products-content";
import { NOVA_PRODUCTS } from "@/lib/products";

describe("products-content", () => {
  it("getProductContent returns undefined for unknown slug", () => {
    expect(getProductContent("not-a-slug")).toBeUndefined();
    expect(getProductContent("")).toBeUndefined();
  });

  it("PRODUCTS_CONTENT is a record", () => {
    expect(typeof PRODUCTS_CONTENT).toBe("object");
  });
});

describe("PRODUCTS_CONTENT covers every NOVA_PRODUCTS slug", () => {
  for (const p of NOVA_PRODUCTS) {
    it(`${p.slug} has content defined`, () => {
      expect(PRODUCTS_CONTENT[p.slug]).toBeDefined();
    });
  }
});

const POPULATED: ReadonlyArray<keyof typeof PRODUCTS_CONTENT> = [
  "energy",
  "sleep",
  "glow",
  "shield",
  "zen",
  "woman",
];

describe("PRODUCTS_CONTENT (all 6 slugs)", () => {
  for (const slug of POPULATED) {
    describe(slug, () => {
      const c = PRODUCTS_CONTENT[slug];

      it("has all required fields populated", () => {
        expect(c).toBeDefined();
        expect(c.hero.headline.length).toBeGreaterThan(0);
        expect(c.hero.subhead.length).toBeGreaterThan(0);
        expect(c.problem.bullets.length).toBeGreaterThanOrEqual(3);
        expect(c.target.primary.length).toBeGreaterThanOrEqual(4);
        expect(c.target.not_for.length).toBeGreaterThanOrEqual(3);
        expect(c.moments.items.length).toBe(3);
        expect(c.promises.promise.length).toBeGreaterThanOrEqual(4);
        expect(c.promises.not_promise.length).toBeGreaterThanOrEqual(3);
        expect(c.claims.items.length).toBeGreaterThanOrEqual(4);
        expect(c.claims.items.length).toBeLessThanOrEqual(6);
        expect(c.faq.length).toBe(4);
        expect(c.tagline.length).toBeGreaterThan(0);
      });

      it("formula.ingredients covers every canonical ingredient", () => {
        const product = NOVA_PRODUCTS.find((p) => p.slug === slug)!;
        const have = new Set(
          c.formula.ingredients.map((i) => i.name.toLowerCase()),
        );
        for (const ing of product.ingredients) {
          expect(have.has(ing.toLowerCase())).toBe(true);
        }
      });
    });
  }
});
