import type { MarketId } from "@novapatch/markets";
import type { DiscountInput } from "@novapatch/pricing";
import type { DiscountCode } from "../db/schema/discounts";

export type DiscountRejectionReason =
  | "discount_not_found"
  | "discount_below_minimum"
  | "discount_max_uses_reached"
  | "discount_max_per_customer_reached";

export type ValidateDiscountResult =
  | {
      ok: true;
      discountCodeId: string;
      discount: DiscountInput;
      code: DiscountCode;
    }
  | { ok: false; reason: DiscountRejectionReason };

export interface ValidateDiscountInput {
  code: string;
  market: MarketId;
  subtotal: number;
  customerId?: string;
  now: Date;
  findActiveByCode: (args: {
    code: string;
    market: MarketId;
    now: Date;
  }) => Promise<DiscountCode | undefined>;
  countRedemptionsByCustomer: (args: {
    discountCodeId: string;
    customerId: string;
  }) => Promise<number>;
}

export async function validateDiscount(
  input: ValidateDiscountInput,
): Promise<ValidateDiscountResult> {
  const code = await input.findActiveByCode({
    code: input.code,
    market: input.market,
    now: input.now,
  });
  if (!code) return { ok: false, reason: "discount_not_found" };

  if (code.minSubtotal !== null && input.subtotal < code.minSubtotal) {
    return { ok: false, reason: "discount_below_minimum" };
  }

  if (code.maxUses !== null && code.timesUsed >= code.maxUses) {
    return { ok: false, reason: "discount_max_uses_reached" };
  }

  if (code.maxUsesPerCustomer !== null && input.customerId) {
    const used = await input.countRedemptionsByCustomer({
      discountCodeId: code.id,
      customerId: input.customerId,
    });
    if (used >= code.maxUsesPerCustomer) {
      return { ok: false, reason: "discount_max_per_customer_reached" };
    }
  }

  return {
    ok: true,
    discountCodeId: code.id,
    code,
    discount: {
      code: code.code,
      discountPct: code.discountPct,
      appliesTo: code.appliesTo as DiscountInput["appliesTo"],
    },
  };
}
