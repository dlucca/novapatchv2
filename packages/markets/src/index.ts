import type { Market, MarketId } from "./types";

export * from "./types";

export const MARKETS: Record<MarketId, Market> = {
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

const MARKET_IDS = Object.keys(MARKETS) as MarketId[];

export function isMarketId(value: unknown): value is MarketId {
  return typeof value === "string" && (MARKET_IDS as string[]).includes(value.toLowerCase());
}

export function resolveMarket(value: string): Market {
  const lower = value.toLowerCase();
  if (!isMarketId(lower)) {
    throw new Error(`unknown market: ${value}`);
  }
  return MARKETS[lower];
}
