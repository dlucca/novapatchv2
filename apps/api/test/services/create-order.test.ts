import { describe, it, expect } from "bun:test";
import { MARKETS } from "@novapatch/markets";
import { calculateQuote } from "@novapatch/pricing";
import { createOrderFromCart } from "../../src/services/create-order";

const FIXED_NOW = new Date("2026-05-01T00:00:00Z");
const getNow = () => FIXED_NOW;

const shippingAddress = {
  line1: "Av. X 1",
  city: "CDMX",
  state: "CDMX",
  postalCode: "00000",
  country: "MX",
};

describe("createOrderFromCart", () => {
  it("builds an order + one item for a one-time cart, no discount, no subscriptions", () => {
    const quote = calculateQuote({
      items: [{ slug: "energy", quantity: 2 }],
      market: MARKETS.mx,
    });
    const out = createOrderFromCart({
      quote,
      customerId: "11111111-1111-1111-1111-111111111111",
      market: MARKETS.mx,
      shippingAddress,
      paymentProvider: "stub",
      paymentChargeId: "stub_abc",
      idempotencyKey: "ik-1",
      items: [{ slug: "energy", quantity: 2 }],
      getNow,
    });

    expect(out.order).toMatchObject({
      customerId: "11111111-1111-1111-1111-111111111111",
      market: "mx",
      currency: "MXN",
      subtotal: quote.subtotal,
      tax: quote.tax,
      shipping: quote.shipping,
      total: quote.total,
      discountAmount: 0,
      status: "paid",
      paymentProvider: "stub",
      paymentChargeId: "stub_abc",
      idempotencyKey: "ik-1",
      shippingAddress,
    });
    expect(out.order.discountCodeId).toBeUndefined();
    expect(out.orderItems).toHaveLength(1);
    expect(out.orderItems[0]).toMatchObject({
      productSlug: "energy",
      name: "Energy",
      unitPrice: 45000,
      quantity: 2,
      isSubscription: false,
    });
    expect(out.subscriptions).toEqual([]);
    expect(out.redemption).toBeUndefined();
  });

  it("creates one subscription per recurring line with nextBillingDate = getNow + intervalDays", () => {
    const items = [
      { slug: "sleep" as const, quantity: 1, subscription: { interval: 30 as const } },
      { slug: "glow" as const, quantity: 1, subscription: { interval: 90 as const } },
    ];
    const quote = calculateQuote({ items, market: MARKETS.mx });
    const out = createOrderFromCart({
      quote,
      customerId: "c-uuid",
      market: MARKETS.mx,
      shippingAddress,
      paymentProvider: "stub",
      paymentChargeId: "stub_abc",
      idempotencyKey: "ik-sub",
      items,
      getNow,
    });

    expect(out.subscriptions).toHaveLength(2);
    expect(out.subscriptions[0]).toMatchObject({
      customerId: "c-uuid",
      productSlug: "sleep",
      intervalDays: 30,
      quantity: 1,
      unitPrice: 36000, // 45000 * 0.80
      market: "mx",
      currency: "MXN",
      status: "active",
      nextBillingDate: "2026-05-31",
      shippingAddress,
    });
    expect(out.subscriptions[1]).toMatchObject({
      productSlug: "glow",
      intervalDays: 90,
      unitPrice: 40500, // 45000 * 0.90
      nextBillingDate: "2026-07-30",
    });
  });

  it("emits a redemption row when a discount result is passed", () => {
    const items = [{ slug: "energy" as const, quantity: 1 }];
    const quote = calculateQuote({
      items,
      market: MARKETS.mx,
      discount: { code: "welcome10", discountPct: 10, appliesTo: "all" },
    });
    const out = createOrderFromCart({
      quote,
      customerId: "c-uuid",
      market: MARKETS.mx,
      shippingAddress,
      paymentProvider: "stub",
      paymentChargeId: "stub_abc",
      idempotencyKey: "ik-d",
      items,
      getNow,
      discountResult: {
        discountCodeId: "d-uuid",
        discount: { code: "welcome10", discountPct: 10, appliesTo: "all" },
        influencerId: null,
      },
    });

    expect(out.order.discountCodeId).toBe("d-uuid");
    expect(out.order.discountAmount).toBe(quote.discountAmount);
    expect(out.redemption).toEqual({
      discountCodeId: "d-uuid",
      customerId: "c-uuid",
      discountAmount: quote.discountAmount,
      influencerId: null,
      commissionAmount: null,
    });
  });

  it("mixed cart + discount produces order + items + sub + redemption", () => {
    const items = [
      { slug: "energy" as const, quantity: 1 },
      { slug: "sleep" as const, quantity: 1, subscription: { interval: 30 as const } },
    ];
    const quote = calculateQuote({
      items,
      market: MARKETS.mx,
      discount: { code: "welcome10", discountPct: 10, appliesTo: "all" },
    });
    const out = createOrderFromCart({
      quote,
      customerId: "c-uuid",
      market: MARKETS.mx,
      shippingAddress,
      paymentProvider: "stub",
      paymentChargeId: "stub_abc",
      idempotencyKey: "ik-mix",
      items,
      getNow,
      discountResult: {
        discountCodeId: "d-uuid",
        discount: { code: "welcome10", discountPct: 10, appliesTo: "all" },
        influencerId: "inf-uuid",
      },
    });

    expect(out.orderItems).toHaveLength(2);
    expect(out.orderItems[0]?.isSubscription).toBe(false);
    expect(out.orderItems[1]?.isSubscription).toBe(true);
    expect(out.orderItems[1]?.intervalDays).toBe(30);
    expect(out.orderItems[1]?.discountPct).toBe(20); // frequency discount on sub line
    expect(out.subscriptions).toHaveLength(1);
    expect(out.redemption?.influencerId).toBe("inf-uuid");
  });
});
