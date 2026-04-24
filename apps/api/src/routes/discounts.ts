import { Hono } from "hono";
import { z } from "zod";
import { resolveMarket, isMarketId } from "@novapatch/markets";
import { calculateQuote, type CartItemInput } from "@novapatch/pricing";
import type { Db } from "../db";
import { apiError } from "../lib/errors";
import {
  findActiveByCode,
  countRedemptionsByCustomer,
} from "../repos/discount-codes";
import { validateDiscount } from "../services/validate-discount";

const ItemSchema = z.object({
  slug: z.enum(["energy", "sleep", "glow", "shield", "zen", "woman"]),
  quantity: z.number().int().min(1),
  subscription: z
    .object({ interval: z.union([z.literal(30), z.literal(60), z.literal(90)]) })
    .optional(),
});

const BodySchema = z.object({
  code: z.string().min(1).max(64),
  market: z.string().min(1).max(8),
  items: z.array(ItemSchema).min(1),
  customerId: z.string().uuid().optional(),
});

export function createDiscountRoutes(db: Db): Hono {
  const r = new Hono();

  r.post("/validate", async (c) => {
    const parsed = BodySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      const { body, status } = apiError(
        "validation_failed",
        "invalid request body",
        400,
        parsed.error.flatten(),
      );
      return c.json(body, status);
    }
    const input = parsed.data;

    // Normalize items: strip undefined `subscription` so exactOptionalPropertyTypes
    // is satisfied (Zod produces `subscription: undefined` for absent optionals).
    const items: CartItemInput[] = input.items.map((item) =>
      item.subscription !== undefined
        ? { slug: item.slug, quantity: item.quantity, subscription: item.subscription }
        : { slug: item.slug, quantity: item.quantity },
    );

    const marketIdRaw = input.market.trim().toLowerCase();
    if (!isMarketId(marketIdRaw)) {
      const { body, status } = apiError(
        "market_unknown",
        `unknown market: ${input.market}`,
        400,
      );
      return c.json(body, status);
    }
    const market = resolveMarket(marketIdRaw);

    // Compute a no-discount quote first so we know the subtotal.
    const draft = calculateQuote({ items, market });

    const result = await validateDiscount({
      code: input.code,
      market: market.id,
      subtotal: draft.subtotal,
      ...(input.customerId ? { customerId: input.customerId } : {}),
      now: new Date(),
      findActiveByCode: (args) => findActiveByCode(db, args),
      countRedemptionsByCustomer: (args) => countRedemptionsByCustomer(db, args),
    });

    if (!result.ok) {
      return c.json({ valid: false as const, reason: result.reason });
    }

    const quote = calculateQuote({
      items,
      market,
      discount: result.discount,
    });

    return c.json({
      valid: true as const,
      code: result.code.code,
      discountPct: result.discount.discountPct,
      appliesTo: result.discount.appliesTo,
      discountAmount: quote.discountAmount,
      eligibleSubtotal: quote.eligibleSubtotal,
      quote,
    });
  });

  return r;
}
