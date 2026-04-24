import { describe, it, expect } from "bun:test";
import { MARKETS } from "../src/index";

describe("MARKETS", () => {
  it("defines all 5 LATAM markets", () => {
    expect(Object.keys(MARKETS).sort()).toEqual(["ar", "br", "cl", "co", "mx"]);
  });

  it("MX uses openpay and MXN", () => {
    expect(MARKETS.mx.currency).toBe("MXN");
    expect(MARKETS.mx.paymentProvider).toBe("openpay");
    expect(MARKETS.mx.taxRate).toBe(0.16);
  });

  it("non-MX markets use mercadopago", () => {
    for (const id of ["br", "ar", "cl", "co"] as const) {
      expect(MARKETS[id].paymentProvider).toBe("mercadopago");
    }
  });

  it("every market has integer shippingFlat in cents", () => {
    for (const id of Object.keys(MARKETS) as (keyof typeof MARKETS)[]) {
      expect(Number.isInteger(MARKETS[id].shippingFlat)).toBe(true);
      expect(MARKETS[id].shippingFlat).toBeGreaterThan(0);
    }
  });
});

import { resolveMarket, isMarketId } from "../src/index";

describe("resolveMarket", () => {
  it("returns market for valid id", () => {
    const m = resolveMarket("mx");
    expect(m.currency).toBe("MXN");
  });

  it("is case-insensitive", () => {
    const m = resolveMarket("MX");
    expect(m.id).toBe("mx");
  });

  it("throws for invalid id", () => {
    expect(() => resolveMarket("us")).toThrow(/unknown market/i);
  });
});

describe("isMarketId", () => {
  it("true for known market ids", () => {
    expect(isMarketId("mx")).toBe(true);
  });

  it("false for unknown strings", () => {
    expect(isMarketId("us")).toBe(false);
    expect(isMarketId("")).toBe(false);
  });

  it("is case-sensitive (strict type-guard)", () => {
    expect(isMarketId("MX")).toBe(false);
    expect(isMarketId("Mx")).toBe(false);
  });
});
