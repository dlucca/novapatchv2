import type { Product, ProductSlug } from "./types";
import { PRODUCTS } from "./products";
import { DISPLAY_ORDER } from "./types";

export * from "./types";
export { PRODUCTS } from "./products";

const PRODUCT_SLUGS = [
  "energy", "sleep", "glow", "shield", "zen", "woman",
] as const satisfies readonly ProductSlug[];

/** Strict type-predicate for ProductSlug. Case-sensitive. */
export function isProductSlug(value: unknown): value is ProductSlug {
  return typeof value === "string" && (PRODUCT_SLUGS as readonly string[]).includes(value);
}

/** Returns the product for a slug, or undefined if unknown. */
export function getProduct(slug: string): Product | undefined {
  return isProductSlug(slug) ? PRODUCTS[slug] : undefined;
}

/** Returns all products in the canonical display order. */
export function listProducts(): Product[] {
  return DISPLAY_ORDER.map((slug) => PRODUCTS[slug]);
}

export { getPriceForMarket, getSubscriptionPrice } from "./pricing";
