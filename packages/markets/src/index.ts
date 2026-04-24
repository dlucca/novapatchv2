import type { Market, MarketId } from "./types";

export * from "./types";

export const MARKETS: Readonly<Record<MarketId, Readonly<Market>>> = {
  mx: {
    id: "mx",
    currency: "MXN",
    locale: "es-MX",
    paymentProvider: "openpay",
    taxRate: 0.16,
    shippingFlat: 8500,
  },
  br: {
    id: "br",
    currency: "BRL",
    locale: "pt-BR",
    paymentProvider: "mercadopago",
    taxRate: 0.17,
    shippingFlat: 2500,
  },
  ar: {
    id: "ar",
    currency: "ARS",
    locale: "es-AR",
    paymentProvider: "mercadopago",
    taxRate: 0.21,
    shippingFlat: 300000,
  },
  cl: {
    id: "cl",
    currency: "CLP",
    locale: "es-CL",
    paymentProvider: "mercadopago",
    taxRate: 0.19,
    shippingFlat: 500000,
  },
  co: {
    id: "co",
    currency: "COP",
    locale: "es-CO",
    paymentProvider: "mercadopago",
    taxRate: 0.19,
    shippingFlat: 2000000,
  },
};

const MARKET_IDS = ["mx", "br", "ar", "cl", "co"] as const satisfies readonly MarketId[];

/** Strict type-predicate for MarketId. Case-sensitive — does not normalize input. */
export function isMarketId(value: unknown): value is MarketId {
  return typeof value === "string" && (MARKET_IDS as readonly string[]).includes(value);
}

/**
 * Resolves a Market by its id. Case-insensitive — "MX", "mx", and "Mx" all resolve to MARKETS.mx.
 * Throws if the value is not a known MarketId.
 */
export function resolveMarket(value: string): Market {
  const lower = value.toLowerCase();
  if (!isMarketId(lower)) {
    throw new Error(`unknown market: ${value}`);
  }
  return MARKETS[lower];
}
