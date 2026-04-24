import type { Market } from "@novapatch/markets";
import type { CartItemInput, DiscountInput, PricingQuote } from "@novapatch/pricing";
import { getProduct } from "@novapatch/catalog";
import type { NewOrder, NewOrderItem } from "../db/schema/orders";
import type { NewSubscription } from "../db/schema/subscriptions";

/**
 * The subset of `ValidateDiscountResult.ok === true` that the order builder
 * needs. Passing a narrowed shape (rather than the full union) keeps this
 * module agnostic to how the caller validated the discount.
 */
export interface DiscountResultForOrder {
  discountCodeId: string;
  discount: DiscountInput;
  influencerId: string | null;
}

export interface CreateOrderInput {
  quote: PricingQuote;
  customerId: string;
  market: Market;
  shippingAddress: Record<string, unknown>;
  paymentProvider: string;
  paymentChargeId: string;
  idempotencyKey: string;
  items: readonly CartItemInput[];
  getNow: () => Date;
  discountResult?: DiscountResultForOrder;
}

/**
 * Shape of a redemption row without the `orderId` (filled by persistOrder
 * because the insert of `orders` is what generates the id).
 */
export interface PendingRedemption {
  discountCodeId: string;
  customerId: string;
  discountAmount: number;
  influencerId: string | null;
  commissionAmount: number | null;
}

export interface CreateOrderOutput {
  order: NewOrder;
  orderItems: Omit<NewOrderItem, "orderId">[];
  redemption?: PendingRedemption;
  subscriptions: Omit<NewSubscription, "originalOrderId">[];
}

export function createOrderFromCart(input: CreateOrderInput): CreateOrderOutput {
  const { quote, customerId, market, shippingAddress, items, getNow } = input;

  const order: NewOrder = {
    customerId,
    market: market.id,
    currency: market.currency,
    subtotal: quote.subtotal,
    tax: quote.tax,
    shipping: quote.shipping,
    total: quote.total,
    discountAmount: quote.discountAmount,
    status: "paid",
    paymentProvider: input.paymentProvider,
    paymentChargeId: input.paymentChargeId,
    shippingAddress,
    idempotencyKey: input.idempotencyKey,
    ...(input.discountResult ? { discountCodeId: input.discountResult.discountCodeId } : {}),
    ...(input.discountResult?.influencerId
      ? { influencerId: input.discountResult.influencerId }
      : {}),
  };

  const orderItems: Omit<NewOrderItem, "orderId">[] = items.map((item, i) => {
    const line = quote.lines[i];
    if (!line) {
      throw new Error(`createOrderFromCart: quote.lines[${i}] missing for item ${item.slug}`);
    }
    const product = getProduct(item.slug);
    if (!product) {
      throw new Error(`createOrderFromCart: unknown product ${item.slug}`);
    }
    const base: Omit<NewOrderItem, "orderId"> = {
      productSlug: item.slug,
      name: product.name,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      isSubscription: line.isSubscription,
    };
    if (item.subscription) {
      return {
        ...base,
        intervalDays: item.subscription.interval,
        discountPct: product.subscriptionDiscounts[item.subscription.interval],
      };
    }
    return base;
  });

  const subscriptions: Omit<NewSubscription, "originalOrderId">[] = items.flatMap((item, i) => {
    if (!item.subscription) return [];
    const line = quote.lines[i];
    if (!line) {
      throw new Error(`createOrderFromCart: quote.lines[${i}] missing for sub item ${item.slug}`);
    }
    const now = getNow();
    const next = new Date(now);
    next.setUTCDate(next.getUTCDate() + item.subscription.interval);
    const nextBillingDate = next.toISOString().slice(0, 10); // YYYY-MM-DD
    return [
      {
        customerId,
        productSlug: item.slug,
        intervalDays: item.subscription.interval,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        market: market.id,
        currency: market.currency,
        status: "active",
        nextBillingDate,
        shippingAddress,
      },
    ];
  });

  const output: CreateOrderOutput = { order, orderItems, subscriptions };
  if (input.discountResult) {
    output.redemption = {
      discountCodeId: input.discountResult.discountCodeId,
      customerId,
      discountAmount: quote.discountAmount,
      influencerId: input.discountResult.influencerId,
      commissionAmount: null,
    };
  }
  return output;
}
