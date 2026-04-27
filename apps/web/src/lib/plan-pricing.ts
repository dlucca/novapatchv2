import { RETAIL_PRICE, SUB_DISCOUNTS } from "@/lib/products";

export type Freq = 30 | 60 | 90;

export type PlanItem = {
  slug: string;
  freq: Freq;
};

/**
 * Discounted price per box at the chosen frequency.
 * Rounded to whole MXN — this is the price the user sees and the value passed
 * to `useCart.addItem(p, price, sub)`.
 */
export function perBox(freq: Freq, retail: number = RETAIL_PRICE): number {
  return Math.round(retail * (1 - SUB_DISCOUNTS[freq]));
}

/**
 * Monthly cost of one item — discounted price amortised over the cycle.
 * Returns the unrounded value so sums stay accurate; round at display.
 */
export function monthlyOf(freq: Freq, retail: number = RETAIL_PRICE): number {
  const cycleMonths = freq / 30;
  return (retail * (1 - SUB_DISCOUNTS[freq])) / cycleMonths;
}

/**
 * "What it would cost without a subscription" — retail amortised over the cycle.
 */
export function fullMonthlyOf(freq: Freq, retail: number = RETAIL_PRICE): number {
  return retail / (freq / 30);
}

export function monthly(items: PlanItem[], retail: number = RETAIL_PRICE): number {
  return items.reduce((acc, it) => acc + monthlyOf(it.freq, retail), 0);
}

export function fullMonthly(items: PlanItem[], retail: number = RETAIL_PRICE): number {
  return items.reduce((acc, it) => acc + fullMonthlyOf(it.freq, retail), 0);
}

export function saved(items: PlanItem[], retail: number = RETAIL_PRICE): number {
  return fullMonthly(items, retail) - monthly(items, retail);
}

export function discountPercent(freq: Freq): 20 | 15 | 10 {
  return Math.round(SUB_DISCOUNTS[freq] * 100) as 20 | 15 | 10;
}
