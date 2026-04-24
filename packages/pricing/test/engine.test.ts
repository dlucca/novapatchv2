import { describe, it, expect } from "bun:test";
import { MARKETS } from "@novapatch/markets";
import { calculateQuote } from "../src/engine";

describe("calculateQuote — no discount", () => {
  it("computes a single one-time item in MX", () => {
    const q = calculateQuote({
      items: [{ slug: "energy", quantity: 1 }],
      market: MARKETS.mx,
    });
    expect(q.market).toBe("mx");
    expect(q.currency).toBe("MXN");
    expect(q.lines).toHaveLength(1);
    expect(q.lines[0]).toMatchObject({
      slug: "energy",
      quantity: 1,
      unitPrice: 45000,
      lineSubtotal: 45000,
      isSubscription: false,
    });
    expect(q.subtotal).toBe(45000);
    expect(q.discountAmount).toBe(0);
    expect(q.taxableBase).toBe(45000);
    expect(q.tax).toBe(7200);     // round(45000 * 0.16)
    expect(q.shipping).toBe(8500);
    expect(q.total).toBe(45000 + 7200 + 8500);
  });

  it("sums multiple lines and applies frequency discount on subscription lines", () => {
    const q = calculateQuote({
      items: [
        { slug: "energy", quantity: 2 }, // 45000 * 2 = 90000
        { slug: "sleep", quantity: 1, subscription: { interval: 30 } }, // 45000 * 0.80 = 36000
      ],
      market: MARKETS.mx,
    });
    expect(q.lines).toHaveLength(2);
    expect(q.lines[1]).toMatchObject({
      slug: "sleep",
      isSubscription: true,
      interval: 30,
      unitPrice: 36000,
      lineSubtotal: 36000,
    });
    expect(q.subtotal).toBe(90000 + 36000);
    expect(q.taxableBase).toBe(126000);
    expect(q.tax).toBe(Math.round(126000 * 0.16));
    expect(q.shipping).toBe(8500);
    expect(q.total).toBe(126000 + q.tax + 8500);
  });

  it("throws on quantity < 1", () => {
    expect(() =>
      calculateQuote({
        items: [{ slug: "energy", quantity: 0 }],
        market: MARKETS.mx,
      }),
    ).toThrow(/quantity must be >= 1/);
  });

  it("throws on unknown slug", () => {
    expect(() =>
      calculateQuote({
        // @ts-expect-error — deliberately invalid for runtime guard
        items: [{ slug: "bogus", quantity: 1 }],
        market: MARKETS.mx,
      }),
    ).toThrow(/unknown product/);
  });

  it("computes correctly in BR (pt-BR market, 17% tax, 2500 shipping)", () => {
    const q = calculateQuote({
      items: [{ slug: "glow", quantity: 1 }],
      market: MARKETS.br,
    });
    expect(q.currency).toBe("BRL");
    expect(q.subtotal).toBe(8900);
    expect(q.tax).toBe(Math.round(8900 * 0.17));
    expect(q.shipping).toBe(2500);
  });
});
