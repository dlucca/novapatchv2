import type { MarketId } from "@novapatch/markets";

export type ProductSlug =
  | "energy"
  | "sleep"
  | "glow"
  | "shield"
  | "zen"
  | "woman";

export type SubscriptionInterval = 30 | 60 | 90;

export interface Product {
  slug: ProductSlug;
  name: string;
  description: string;
  readonly images: readonly string[];
  readonly basePrice: Readonly<Record<MarketId, number>>;
  isStockable: boolean;
  readonly subscriptionDiscounts: Readonly<Record<SubscriptionInterval, number>>;
}

export const DISPLAY_ORDER: readonly ProductSlug[] = [
  "energy",
  "sleep",
  "glow",
  "shield",
  "zen",
  "woman",
] as const;
