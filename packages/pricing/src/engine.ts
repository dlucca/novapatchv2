import { getProduct, getPriceForMarket, getSubscriptionPrice } from "@novapatch/catalog";
import type { Market } from "@novapatch/markets";
import type { CartItemInput, DiscountInput, PricingQuote, QuoteLine } from "./types";

export interface CalculateQuoteInput {
  items: readonly CartItemInput[];
  market: Market;
  discount?: DiscountInput;
}

export function calculateQuote(input: CalculateQuoteInput): PricingQuote {
  if (input.items.length === 0) {
    throw new Error("calculateQuote: items must not be empty");
  }

  const lines: QuoteLine[] = input.items.map((item) => {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error(`quantity must be >= 1 (got ${item.quantity} for ${item.slug})`);
    }
    const product = getProduct(item.slug);
    if (!product) {
      throw new Error(`unknown product: ${item.slug}`);
    }
    const unitPrice = item.subscription
      ? getSubscriptionPrice(product, input.market.id, item.subscription.interval)
      : getPriceForMarket(product, input.market.id);
    const line: QuoteLine = {
      slug: item.slug,
      quantity: item.quantity,
      unitPrice,
      lineSubtotal: unitPrice * item.quantity,
      isSubscription: Boolean(item.subscription),
      ...(item.subscription ? { interval: item.subscription.interval } : {}),
    };
    return line;
  });

  const subtotal = lines.reduce((sum, l) => sum + l.lineSubtotal, 0);

  // Discount path is covered by Task 3. For now, always 0.
  const discountAmount = 0;

  const taxableBase = subtotal - discountAmount;
  const tax = Math.round(taxableBase * input.market.taxRate);
  const shipping = input.market.shippingFlat;
  const total = taxableBase + tax + shipping;

  return {
    market: input.market.id,
    currency: input.market.currency,
    lines,
    subtotal,
    discountAmount,
    taxableBase,
    tax,
    shipping,
    total,
  };
}
