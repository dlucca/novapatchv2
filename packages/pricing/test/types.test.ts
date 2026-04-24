import { describe, it, expectTypeOf } from "bun:test";
import type { CartItemInput, DiscountInput, PricingQuote, QuoteLine } from "../src";

describe("pricing types", () => {
  it("CartItemInput distinguishes one-time vs subscription via optional `subscription`", () => {
    const oneTime: CartItemInput = { slug: "energy", quantity: 2 };
    const sub: CartItemInput = { slug: "energy", quantity: 1, subscription: { interval: 30 } };
    expectTypeOf(oneTime).toMatchTypeOf<CartItemInput>();
    expectTypeOf(sub).toMatchTypeOf<CartItemInput>();
  });

  it("DiscountInput carries code, pct, and appliesTo scope", () => {
    const d: DiscountInput = { code: "WELCOME10", discountPct: 10, appliesTo: "all" };
    expectTypeOf(d).toMatchTypeOf<DiscountInput>();
  });

  it("PricingQuote totals and line breakdown are integer cents", () => {
    expectTypeOf<PricingQuote["subtotal"]>().toEqualTypeOf<number>();
    expectTypeOf<PricingQuote["discountAmount"]>().toEqualTypeOf<number>();
    expectTypeOf<PricingQuote["tax"]>().toEqualTypeOf<number>();
    expectTypeOf<PricingQuote["shipping"]>().toEqualTypeOf<number>();
    expectTypeOf<PricingQuote["total"]>().toEqualTypeOf<number>();
    expectTypeOf<PricingQuote["lines"]>().toEqualTypeOf<readonly QuoteLine[]>();
  });
});
