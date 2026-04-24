import type { Product, ProductSlug } from "./types";
import { PRODUCTS } from "./products";
import { DISPLAY_ORDER } from "./types";

export * from "./types";
export { PRODUCTS } from "./products";
export { getPriceForMarket, getSubscriptionPrice } from "./pricing";

/** Returns the product for a slug, or undefined if unknown. */
export function getProduct(slug: string): Product | undefined {
  return PRODUCTS[slug as ProductSlug];
}

/** Returns all products in the canonical display order. */
export function listProducts(): Product[] {
  return DISPLAY_ORDER.map((slug) => PRODUCTS[slug]);
}
