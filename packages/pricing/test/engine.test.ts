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
      unitPrice: 75000,
      lineSubtotal: 75000,
      isSubscription: false,
    });
    expect(q.subtotal).toBe(75000);
    expect(q.eligibleSubtotal).toBe(75000);
    expect(q.discountAmount).toBe(0);
    expect(q.taxableBase).toBe(75000);
    // MX prices are tax-inclusive in the catalog → engine tax component is 0.
    expect(q.tax).toBe(0);
    expect(q.shipping).toBe(8500);
    expect(q.total).toBe(75000 + 8500);
  });

  it("sums multiple lines and applies frequency discount on subscription lines", () => {
    const q = calculateQuote({
      items: [
        { slug: "energy", quantity: 2 }, // 75000 * 2 = 150000
        { slug: "sleep", quantity: 1, subscription: { interval: 30 } }, // 75000 * 0.85 = 63750
      ],
      market: MARKETS.mx,
    });
    expect(q.lines).toHaveLength(2);
    expect(q.lines[1]).toMatchObject({
      slug: "sleep",
      isSubscription: true,
      interval: 30,
      unitPrice: 63750,
      lineSubtotal: 63750,
    });
    expect(q.subtotal).toBe(150000 + 63750);
    expect(q.taxableBase).toBe(213750);
    expect(q.tax).toBe(0);
    expect(q.shipping).toBe(8500);
    expect(q.total).toBe(213750 + 8500);
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
    expect(q.subtotal).toBe(14900);
    expect(q.tax).toBe(Math.round(14900 * 0.17));
    expect(q.shipping).toBe(2500);
  });
});

describe("calculateQuote — with discount", () => {
  it("applies an `all` discount to full subtotal", () => {
    const q = calculateQuote({
      items: [
        { slug: "energy", quantity: 1 }, // 75000
        { slug: "sleep", quantity: 1, subscription: { interval: 30 } }, // 63750
      ],
      market: MARKETS.mx,
      discount: { code: "WELCOME10", discountPct: 10, appliesTo: "all" },
    });
    expect(q.subtotal).toBe(138750);
    expect(q.eligibleSubtotal).toBe(138750);
    expect(q.discountAmount).toBe(Math.round(138750 * 0.10)); // 13875
    expect(q.taxableBase).toBe(138750 - 13875);
    expect(q.tax).toBe(0);
    expect(q.total).toBe(q.taxableBase + q.shipping);
  });

  it("applies a `once` discount only to one-time lines", () => {
    const q = calculateQuote({
      items: [
        { slug: "energy", quantity: 1 }, // 75000 one-time
        { slug: "sleep", quantity: 1, subscription: { interval: 30 } }, // 63750 sub
      ],
      market: MARKETS.mx,
      discount: { code: "ONCE15", discountPct: 15, appliesTo: "once" },
    });
    // Only the 75000 one-time portion is eligible.
    expect(q.eligibleSubtotal).toBe(75000);
    expect(q.discountAmount).toBe(Math.round(75000 * 0.15));
  });

  it("applies a `subscription` discount only to subscription lines", () => {
    const q = calculateQuote({
      items: [
        { slug: "energy", quantity: 1 }, // 75000 one-time
        { slug: "sleep", quantity: 1, subscription: { interval: 30 } }, // 63750 sub
      ],
      market: MARKETS.mx,
      discount: { code: "SUB20", discountPct: 20, appliesTo: "subscription" },
    });
    expect(q.eligibleSubtotal).toBe(63750);
    expect(q.discountAmount).toBe(Math.round(63750 * 0.20));
  });

  it("applies 0 when scope matches no lines", () => {
    const q = calculateQuote({
      items: [{ slug: "energy", quantity: 1 }], // only one-time
      market: MARKETS.mx,
      discount: { code: "SUBONLY", discountPct: 25, appliesTo: "subscription" },
    });
    expect(q.discountAmount).toBe(0);
    expect(q.eligibleSubtotal).toBe(0);
    expect(q.taxableBase).toBe(75000);
  });

  it("rounds discountAmount (not floor/ceil)", () => {
    const q = calculateQuote({
      items: [{ slug: "energy", quantity: 3 }],
      market: MARKETS.mx,
      discount: { code: "P13", discountPct: 13, appliesTo: "all" },
    });
    expect(q.discountAmount).toBe(Math.round(225000 * 0.13));
  });

  it("throws on discountPct outside 1..100", () => {
    expect(() =>
      calculateQuote({
        items: [{ slug: "energy", quantity: 1 }],
        market: MARKETS.mx,
        discount: { code: "X", discountPct: 0, appliesTo: "all" },
      }),
    ).toThrow(/discountPct must be/);
    expect(() =>
      calculateQuote({
        items: [{ slug: "energy", quantity: 1 }],
        market: MARKETS.mx,
        discount: { code: "X", discountPct: 101, appliesTo: "all" },
      }),
    ).toThrow(/discountPct must be/);
  });
});
