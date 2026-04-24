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
  images: string[];
  basePrice: Record<MarketId, number>;
  isStockable: boolean;
  subscriptionDiscounts: Record<SubscriptionInterval, number>;
}

export const DISPLAY_ORDER: readonly ProductSlug[] = [
  "energy",
  "sleep",
  "glow",
  "shield",
  "zen",
  "woman",
] as const;
