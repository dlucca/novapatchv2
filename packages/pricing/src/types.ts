import type { MarketId } from "@novapatch/markets";
import type { ProductSlug, SubscriptionInterval } from "@novapatch/catalog";

/** Input describing one cart line. `subscription` present ⇒ recurring item (frequency discount applies). */
export interface CartItemInput {
  slug: ProductSlug;
  quantity: number;
  subscription?: { interval: SubscriptionInterval };
}

/** Scope mirrors `discount_codes.applies_to`. */
export type DiscountAppliesTo = "all" | "once" | "subscription";

/** Discount data the engine needs — already fetched + normalized by the caller. */
export interface DiscountInput {
  code: string;
  discountPct: number; // 1..100
  appliesTo: DiscountAppliesTo;
}

/** Per-line breakdown in the final quote. */
export interface QuoteLine {
  slug: ProductSlug;
  quantity: number;
  unitPrice: number;      // cents, already includes frequency discount for subs
  lineSubtotal: number;   // unitPrice * quantity
  isSubscription: boolean;
  interval?: SubscriptionInterval;
}

/** Integer-cent breakdown for the whole cart. All numbers are rounded. */
export interface PricingQuote {
  market: MarketId;
  currency: string;
  lines: readonly QuoteLine[];
  subtotal: number;
  discountAmount: number;
  taxableBase: number;
  tax: number;
  shipping: number;
  total: number;
}
