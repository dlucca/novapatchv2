export type MarketId = "mx" | "br" | "ar" | "cl" | "co";

export type PaymentProvider = "openpay" | "mercadopago";

export interface Market {
  id: MarketId;
  currency: string;       // ISO 4217
  locale: string;         // BCP 47 (e.g. "es-MX")
  paymentProvider: PaymentProvider;
  taxRate: number;        // decimal (0.16 = 16%)
  shippingFlat: number;   // cents in market's currency
}
