import { and, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import type { Db } from "../db";
import { discountCodes, discountRedemptions, type DiscountCode } from "../db/schema/discounts";
import type { MarketId } from "@novapatch/markets";

export interface FindActiveByCodeInput {
  code: string;
  market: MarketId;
  now: Date;
}

/**
 * Looks up a discount code that is usable right now in the given market.
 *
 *  - case-insensitive on `code`
 *  - status = 'active'
 *  - valid_from IS NULL OR valid_from <= now
 *  - valid_until IS NULL OR valid_until >= now
 *  - market present in `markets[]`
 *
 * Returns the row or undefined. Does NOT check max_uses or min_subtotal —
 * those are checked by the validator, which also has the cart subtotal in hand.
 */
export async function findActiveByCode(
  db: Db,
  { code, market, now }: FindActiveByCodeInput,
): Promise<DiscountCode | undefined> {
  const [row] = await db
    .select()
    .from(discountCodes)
    .where(
      and(
        sql`lower(${discountCodes.code}) = lower(${code})`,
        eq(discountCodes.status, "active"),
        or(isNull(discountCodes.validFrom), lte(discountCodes.validFrom, now)),
        or(isNull(discountCodes.validUntil), gte(discountCodes.validUntil, now)),
        sql`${market} = ANY(${discountCodes.markets})`,
      ),
    )
    .limit(1);
  return row;
}

export interface CountRedemptionsInput {
  discountCodeId: string;
  customerId: string;
}

export async function countRedemptionsByCustomer(
  db: Db,
  { discountCodeId, customerId }: CountRedemptionsInput,
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(discountRedemptions)
    .where(
      and(
        eq(discountRedemptions.discountCodeId, discountCodeId),
        eq(discountRedemptions.customerId, customerId),
      ),
    );
  return row?.n ?? 0;
}
