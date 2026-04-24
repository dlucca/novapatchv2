import type { MarketId } from "@novapatch/markets";
import type { Product, SubscriptionInterval } from "./types";

/** Returns the base MSRP (in cents) for a product in a given market. Throws if the product has no price configured for the market. */
export function getPriceForMarket(product: Product, market: MarketId): number {
  const price = product.basePrice[market];
  if (price === undefined) {
    throw new Error(`no price for product ${product.slug} in market ${market}`);
  }
  return price;
}

/** Returns the per-unit subscription price (in cents) with the interval's discount applied. Result is rounded to an integer cent. */
export function getSubscriptionPrice(
  product: Product,
  market: MarketId,
  interval: SubscriptionInterval,
): number {
  const base = getPriceForMarket(product, market);
  const discountPct = product.subscriptionDiscounts[interval];
  const discounted = (base * (100 - discountPct)) / 100;
  return Math.round(discounted);
}
