import { Hono } from "hono";
import { z } from "zod";
import { resolveMarket, isMarketId, type MarketId } from "@novapatch/markets";
import { calculateQuote, type CartItemInput, type PricingQuote, type QuoteLine } from "@novapatch/pricing";
import type { ProductSlug } from "@novapatch/catalog";
import type { Db } from "../db";
import type { ClerkUserClient } from "../lib/clerk";
import type { PaymentGateway } from "../lib/payment-gateway";
import { apiError } from "../lib/errors";
import { upsertCustomerByClerkUserId } from "../repos/customers";
import {
  findActiveByCode,
  countRedemptionsByCustomer,
} from "../repos/discount-codes";
import { validateDiscount } from "../services/validate-discount";
import { createOrderFromCart } from "../services/create-order";
import {
  persistOrder,
  findOrderByIdempotencyKey,
  type OrderWithRelations,
} from "../repos/orders";

const ItemSchema = z.object({
  slug: z.enum(["energy", "sleep", "glow", "shield", "zen", "woman"]),
  quantity: z.number().int().min(1),
  subscription: z
    .object({ interval: z.union([z.literal(30), z.literal(60), z.literal(90)]) })
    .optional(),
});

const ShippingAddressSchema = z.object({
  line1: z.string().min(1).max(200),
  line2: z.string().min(1).max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  country: z.string().min(1).max(3),
});

const BodySchema = z.object({
  market: z.string().min(1).max(8),
  items: z.array(ItemSchema).min(1),
  shippingAddress: ShippingAddressSchema,
  paymentToken: z.string().min(1).max(255),
  deviceSessionId: z.string().min(1).max(255).optional(),
  recurringConsent: z.boolean().optional(),
  discountCode: z.string().min(1).max(64).optional(),
});

export interface CheckoutDeps {
  db: Db;
  userClient: ClerkUserClient;
  gateway: PaymentGateway;
  getNow: () => Date;
}

/**
 * Reconstruct a PricingQuote-shaped object from persisted order + items.
 *
 * Note on `eligibleSubtotal`: the original quote tracks which lines were
 * eligible for the discount (based on appliesTo: "all"|"once"|"subscription").
 * We don't snapshot that scope on the order row, so on replay we return
 * `subtotal` as an upper-bound approximation. This matches the original value
 * when appliesTo==="all" and over-reports for narrower scopes — acceptable for
 * an idempotent replay response.
 */
function reconstructQuote(r: OrderWithRelations): PricingQuote {
  const lines: QuoteLine[] = r.items.map((item) => {
    const base: QuoteLine = {
      slug: item.productSlug as ProductSlug,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineSubtotal: item.unitPrice * item.quantity,
      isSubscription: item.isSubscription,
    };
    return item.intervalDays != null
      ? { ...base, interval: item.intervalDays as 30 | 60 | 90 }
      : base;
  });
  return {
    market: r.order.market as MarketId,
    currency: r.order.currency,
    lines,
    subtotal: r.order.subtotal,
    eligibleSubtotal: r.order.subtotal,
    discountAmount: r.order.discountAmount,
    taxableBase: r.order.subtotal - r.order.discountAmount,
    tax: r.order.tax,
    shipping: r.order.shipping,
    total: r.order.total,
  };
}

function serializeReplay(r: OrderWithRelations) {
  return {
    orderId: r.order.id,
    chargeId: r.order.paymentChargeId,
    quote: reconstructQuote(r),
    subscriptions: r.subscriptions.map((s) => ({
      id: s.id,
      slug: s.productSlug,
      interval: s.intervalDays,
      nextBillingDate: s.nextBillingDate,
    })),
  };
}

export function createCheckoutRoutes(deps: CheckoutDeps): Hono {
  const r = new Hono();

  r.post("/", async (c) => {
    // 1. Idempotency-Key required.
    const idempotencyKey = c.req.header("Idempotency-Key");
    if (!idempotencyKey) {
      const { body, status } = apiError(
        "idempotency_key_missing",
        "Idempotency-Key header is required",
        400,
      );
      return c.json(body, status);
    }

    // 2. Parse body.
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

    // 3. Resolve market.
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

    // 4. Recurring consent gate.
    const hasSubscriptionLine = input.items.some((i) => i.subscription !== undefined);
    if (hasSubscriptionLine && input.recurringConsent !== true) {
      const { body, status } = apiError(
        "validation_failed",
        "recurring_consent_required",
        400,
        { reason: "recurring_consent_required" },
      );
      return c.json(body, status);
    }

    // 5. Upsert customer.
    const clerkUserId = c.get("clerkUserId");
    const { email } = await deps.userClient.getUser(clerkUserId);
    const customer = await upsertCustomerByClerkUserId(deps.db, { clerkUserId, email, market: market.id });

    // 6. Idempotent replay.
    const existing = await findOrderByIdempotencyKey(deps.db, idempotencyKey);
    if (existing) {
      if (existing.order.customerId !== customer.id) {
        // Someone else's key — treat as not-found so we don't leak data.
        const { body, status } = apiError(
          "idempotency_key_missing",
          "Idempotency-Key not found",
          400,
        );
        return c.json(body, status);
      }
      return c.json(serializeReplay(existing), 200);
    }

    // 7. Normalize items (Zod infers subscription: T | undefined; engine expects
    //    the field absent when not set — exactOptionalPropertyTypes).
    const items: CartItemInput[] = input.items.map((item) =>
      item.subscription !== undefined
        ? { slug: item.slug, quantity: item.quantity, subscription: item.subscription }
        : { slug: item.slug, quantity: item.quantity },
    );

    // 8. Draft quote for subtotal (needed by validator).
    const draft = calculateQuote({ items, market });

    // 9. Optional discount validation.
    let discountResultForOrder: Parameters<typeof createOrderFromCart>[0]["discountResult"] =
      undefined;
    let discountInput: Parameters<typeof calculateQuote>[0]["discount"] = undefined;
    if (input.discountCode) {
      const vr = await validateDiscount({
        code: input.discountCode,
        market: market.id,
        subtotal: draft.subtotal,
        customerId: customer.id,
        now: deps.getNow(),
        findActiveByCode: (args) => findActiveByCode(deps.db, args),
        countRedemptionsByCustomer: (args) => countRedemptionsByCustomer(deps.db, args),
      });
      if (!vr.ok) {
        const { body, status } = apiError(vr.reason, vr.reason, 400);
        return c.json(body, status);
      }
      discountInput = vr.discount;
      discountResultForOrder = {
        discountCodeId: vr.discountCodeId,
        discount: vr.discount,
        influencerId: vr.code.influencerId ?? null,
      };
    }

    // 10. Final quote.
    const quote = calculateQuote({
      items,
      market,
      ...(discountInput ? { discount: discountInput } : {}),
    });

    // 11. Charge gateway (CIT — customer-initiated).
    let chargeResult;
    try {
      chargeResult = await deps.gateway.charge({
        token: input.paymentToken,
        amount: quote.total,
        currency: market.currency,
        ...(input.deviceSessionId ? { deviceSessionId: input.deviceSessionId } : {}),
      });
    } catch (err) {
      console.warn(
        "[checkout] gateway threw:",
        err instanceof Error ? err.message : err,
      );
      const { body, status } = apiError(
        "gateway_error",
        "payment gateway is unavailable",
        502,
      );
      return c.json(body, status);
    }

    if (chargeResult.status === "declined") {
      const { body, status } = apiError(
        "payment_declined",
        "payment was declined",
        402,
        { declineReason: chargeResult.declineReason },
      );
      return c.json(body, status);
    }

    // 12. Build order rows.
    const built = createOrderFromCart({
      quote,
      customerId: customer.id,
      market,
      shippingAddress: input.shippingAddress,
      paymentProvider: "stub",
      paymentChargeId: chargeResult.chargeId,
      idempotencyKey,
      items,
      getNow: deps.getNow,
      ...(discountResultForOrder ? { discountResult: discountResultForOrder } : {}),
    });

    // 13. Persist atomically.
    let persisted;
    try {
      persisted = await persistOrder(deps.db, built);
    } catch (err) {
      console.error("[checkout] persist failed after charge succeeded:", err);
      const { body, status } = apiError(
        "internal_error",
        "order persistence failed after charge succeeded",
        500,
        { chargeId: chargeResult.chargeId },
      );
      return c.json(body, status);
    }

    // 14. Respond 201.
    return c.json(
      {
        orderId: persisted.orderId,
        chargeId: chargeResult.chargeId,
        quote,
        subscriptions: built.subscriptions.map((s, i) => ({
          id: persisted.subscriptionIds[i]!,
          slug: s.productSlug,
          interval: s.intervalDays,
          nextBillingDate: s.nextBillingDate,
        })),
      },
      201,
    );
  });

  return r;
}
