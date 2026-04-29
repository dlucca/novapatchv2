import { Hono } from "hono";
import { z } from "zod";
import { resolveMarket, isMarketId } from "@novapatch/markets";
import { calculateQuote, type CartItemInput } from "@novapatch/pricing";
import type { Db } from "../db";
import type { PaymentGateway } from "../lib/payment-gateway";
import { apiError } from "../lib/errors";
import {
  upsertGuestCustomerByEmail,
  setGatewayCredentials,
} from "../repos/customers";
import {
  findActiveByCode,
  countRedemptionsByCustomer,
} from "../repos/discount-codes";
import { validateDiscount } from "../services/validate-discount";
import { createOrderFromCart } from "../services/create-order";
import { persistOrder, findOrderByIdempotencyKey } from "../repos/orders";
import { serviceAuthMiddleware } from "../middleware/service-auth";

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
  customerEmail: z.string().email().max(254),
  market: z.string().min(1).max(8),
  items: z.array(ItemSchema).min(1),
  shippingAddress: ShippingAddressSchema,
  paymentToken: z.string().min(1).max(255),
  recurringConsent: z.boolean().optional(),
  discountCode: z.string().min(1).max(64).optional(),
  /**
   * Gateway-side credentials captured during checkout for off-session
   * renewals. Required when the order has any subscription line (Phase 2);
   * server enforces this combo. Not used for one-time orders.
   */
  gatewayCustomer: z.string().min(1).max(255).optional(),
  paymentMethod: z.string().min(1).max(255).optional(),
});

export interface WebhookCheckoutDeps {
  db: Db;
  gateway: PaymentGateway;
  serviceSecret: string;
  getNow: () => Date;
}

/**
 * Trusted server-to-server checkout for guest orders.
 *
 * Called by the apps/web Stripe webhook on `payment_intent.succeeded`.
 * Authenticates with `X-Service-Auth: <shared_secret>` (NOT Clerk JWT) and
 * identifies the customer by email, creating a guest record if missing.
 *
 * Idempotency: REQUIRED via `Idempotency-Key` header. The webhook uses the
 * Stripe PaymentIntent id (e.g. `pi_3ABC...`) as the key, so:
 *   - Stripe webhook retries → same key → idempotent replay (200, no double insert)
 *   - Frontend success page also calls (future) → same key → also idempotent
 *
 * Otherwise the pipeline is identical to `/me/checkout`:
 *   1. validate body, market, recurring consent
 *   2. upsert customer (by email here, not Clerk id)
 *   3. idempotent replay short-circuit
 *   4. quote + optional discount validation
 *   5. gateway.charge (Stripe gateway: retrieve PI, validate amount/currency)
 *   6. persist order + items + subscriptions atomically
 */
export function createWebhookCheckoutRoutes(deps: WebhookCheckoutDeps): Hono {
  const r = new Hono();

  r.use("*", serviceAuthMiddleware(deps.serviceSecret));

  r.post("/", async (c) => {
    const idempotencyKey = c.req.header("Idempotency-Key");
    if (!idempotencyKey) {
      const { body, status } = apiError(
        "idempotency_key_missing",
        "Idempotency-Key header is required",
        400,
      );
      return c.json(body, status);
    }

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

    // Subscription orders MUST carry gateway credentials so the cron can
    // renew them off-session later. Without them the sub would be created
    // but the very first renewal cycle would fail with `missing_payment_method`.
    if (
      hasSubscriptionLine &&
      (!input.gatewayCustomer || !input.paymentMethod)
    ) {
      const { body, status } = apiError(
        "validation_failed",
        "gateway_credentials_required_for_subscription",
        400,
        { reason: "gateway_credentials_required_for_subscription" },
      );
      return c.json(body, status);
    }

    const customer = await upsertGuestCustomerByEmail(deps.db, {
      email: input.customerEmail,
      market: market.id,
    });

    // Stash gateway credentials so the renewal cron can charge off-session.
    // Done BEFORE the idempotent-replay check so a webhook retry can repair
    // a customer record where credentials were missing the first time.
    if (
      hasSubscriptionLine &&
      input.gatewayCustomer &&
      input.paymentMethod
    ) {
      await setGatewayCredentials(deps.db, {
        customerId: customer.id,
        gatewayName: deps.gateway.name,
        gatewayCustomerId: input.gatewayCustomer,
        paymentMethodId: input.paymentMethod,
        consentAt: deps.getNow(),
      });
    }

    // Idempotent replay — same Idempotency-Key (PI id) returns the existing
    // order without re-charging or re-inserting.
    const existing = await findOrderByIdempotencyKey(deps.db, idempotencyKey);
    if (existing) {
      if (existing.order.customerId !== customer.id) {
        // Email mismatch — refuse without leaking which side is wrong.
        const { body, status } = apiError(
          "idempotency_key_missing",
          "Idempotency-Key not found",
          400,
        );
        return c.json(body, status);
      }
      return c.json(
        {
          orderId: existing.order.id,
          chargeId: existing.order.paymentChargeId,
          replayed: true,
        },
        200,
      );
    }

    const items: CartItemInput[] = input.items.map((item) =>
      item.subscription !== undefined
        ? { slug: item.slug, quantity: item.quantity, subscription: item.subscription }
        : { slug: item.slug, quantity: item.quantity },
    );

    const draft = calculateQuote({ items, market });

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

    const quote = calculateQuote({
      items,
      market,
      ...(discountInput ? { discount: discountInput } : {}),
    });

    let chargeResult;
    try {
      chargeResult = await deps.gateway.charge({
        token: input.paymentToken,
        amount: quote.total,
        currency: market.currency,
      });
    } catch (err) {
      console.warn(
        "[webhook-checkout] gateway threw:",
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

    const built = createOrderFromCart({
      quote,
      customerId: customer.id,
      market,
      shippingAddress: input.shippingAddress,
      paymentProvider: deps.gateway.name,
      paymentChargeId: chargeResult.chargeId,
      idempotencyKey,
      items,
      getNow: deps.getNow,
      ...(discountResultForOrder ? { discountResult: discountResultForOrder } : {}),
    });

    let persisted;
    try {
      persisted = await persistOrder(deps.db, {
        ...built,
        paymentAttempt: {
          provider: deps.gateway.name,
          providerChargeId: chargeResult.chargeId,
          amount: quote.total,
          currency: market.currency,
          status: "succeeded",
        },
      });
    } catch (err) {
      // Race-condition reconciliation: Stripe sometimes fires
      // payment_intent.succeeded multiple times concurrently. The
      // findOrderByIdempotencyKey check above is non-atomic with the
      // INSERT, so two concurrent calls can both pass the replay check and
      // race on insert. The losing INSERT hits
      // `orders_idempotency_key_unique` — recover by re-fetching and
      // returning the existing order (same as a normal idempotent replay).
      const isDupe =
        err !== null &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "23505" &&
        "constraint_name" in err &&
        (err as { constraint_name?: string }).constraint_name ===
          "orders_idempotency_key_unique";
      if (isDupe) {
        const winner = await findOrderByIdempotencyKey(deps.db, idempotencyKey);
        if (winner && winner.order.customerId === customer.id) {
          return c.json(
            {
              orderId: winner.order.id,
              chargeId: winner.order.paymentChargeId,
              replayed: true,
            },
            200,
          );
        }
      }
      console.error(
        "[webhook-checkout] persist failed after charge succeeded:",
        err,
      );
      const { body, status } = apiError(
        "internal_error",
        "order persistence failed after charge succeeded",
        500,
        { chargeId: chargeResult.chargeId },
      );
      return c.json(body, status);
    }

    return c.json(
      {
        orderId: persisted.orderId,
        chargeId: chargeResult.chargeId,
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
