import { resolveMarket, isMarketId } from "@novapatch/markets";
import { getProduct, type ProductSlug } from "@novapatch/catalog";
import type { Db } from "../db";
import type { PaymentGateway } from "../lib/payment-gateway";
import type { SubscriptionRun } from "../db/schema/subscription-runs";
import { tryClaimRun, markStatus } from "../repos/subscription-runs";
import { getCustomerById } from "../repos/customers";
import { persistOrder } from "../repos/orders";
import { updateStatus } from "../repos/subscriptions";
import { subscriptions as subscriptionsTable } from "../db/schema/subscriptions";
import { eq } from "drizzle-orm";
import type { NewOrder, NewOrderItem } from "../db/schema/orders";

export type ProcessRunOutcome =
  | { kind: "skipped"; reason: string }
  | { kind: "succeeded"; orderId: string; chargeId: string }
  | { kind: "failed"; reason: string };

export interface ProcessRunDeps {
  db: Db;
  gateway: PaymentGateway;
  getNow: () => Date;
}

/**
 * Processes a single `pending` subscription_run end-to-end:
 *   1. Atomically claim (pending → processing). Skipped if another worker
 *      already claimed it.
 *   2. Load subscription + customer.
 *   3. If the customer has no saved Stripe customer/payment method, mark the
 *      run failed and the subscription past_due — no recovery without
 *      manual intervention. (Phase 2 of the rollout will populate these on
 *      first checkout.)
 *   4. Compute renewal totals from the subscription snapshot + market
 *      tax/shipping. Renewals do NOT re-apply signup discount codes.
 *   5. Call gateway.chargeRecurring with idempotencyKey = run.id (so a
 *      retried processor doesn't double-charge).
 *   6. On succeeded: persist a renewal order + payment_attempt atomically,
 *      advance subscription.nextBillingDate by intervalDays, mark run
 *      succeeded.
 *   7. On declined: mark run failed (declineReason), set subscription status
 *      past_due. The operator (or a future retry policy) can re-run the
 *      subscription manually.
 *   8. On gateway throw (transient): mark run failed with the error message.
 *      Same disposition for now — keeping the surface small in v1.
 */
export async function processSubscriptionRun(
  deps: ProcessRunDeps,
  run: SubscriptionRun,
): Promise<ProcessRunOutcome> {
  const { db, gateway, getNow } = deps;
  const now = getNow();

  // 1. Claim atomically.
  const claimed = await tryClaimRun(db, run.id, now);
  if (!claimed) {
    return { kind: "skipped", reason: "already_claimed_or_not_pending" };
  }

  // 2. Load subscription + customer.
  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.id, run.subscriptionId))
    .limit(1);
  if (!sub) {
    await markStatus(db, {
      id: run.id,
      status: "failed",
      failureReason: "subscription_not_found",
      finishedAt: getNow(),
      attemptCount: run.attemptCount + 1,
    });
    return { kind: "failed", reason: "subscription_not_found" };
  }

  if (sub.status !== "active") {
    // Sub was paused/canceled between materializer and processor — nothing
    // to do, but don't penalize the customer. Mark as abandoned (an explicit
    // terminal state distinct from "failed").
    await markStatus(db, {
      id: run.id,
      status: "abandoned",
      failureReason: `subscription_status_${sub.status}`,
      finishedAt: getNow(),
      attemptCount: run.attemptCount + 1,
    });
    return { kind: "skipped", reason: `subscription_status_${sub.status}` };
  }

  const customer = await getCustomerById(db, sub.customerId);
  if (!customer) {
    await markStatus(db, {
      id: run.id,
      status: "failed",
      failureReason: "customer_not_found",
      finishedAt: getNow(),
      attemptCount: run.attemptCount + 1,
    });
    return { kind: "failed", reason: "customer_not_found" };
  }

  // 3. Customer must have saved gateway + PM. Phase 1 doesn't capture these
  //    yet, so for now this branch always fires for legacy subs — that's
  //    expected and tested.
  // Read the customer-id-for-this-gateway by name. Schema types this as
  // `{stripe?, mercadopago?}` for the production gateways; we widen here so
  // the stub gateway (tests) and any future provider can plug in by name.
  const gatewayIds = customer.gatewayCustomerIds as Record<string, string | undefined>;
  const customerRef = gatewayIds[gateway.name];
  const paymentMethodRef = customer.defaultCardId;
  if (!customerRef || !paymentMethodRef) {
    await markStatus(db, {
      id: run.id,
      status: "failed",
      failureReason: "missing_payment_method",
      finishedAt: getNow(),
      attemptCount: run.attemptCount + 1,
    });
    await updateStatus(db, { id: sub.id, status: "past_due" });
    return { kind: "failed", reason: "missing_payment_method" };
  }

  // 4. Compute renewal totals from the subscription snapshot.
  if (!isMarketId(sub.market)) {
    await markStatus(db, {
      id: run.id,
      status: "failed",
      failureReason: `unknown_market_${sub.market}`,
      finishedAt: getNow(),
      attemptCount: run.attemptCount + 1,
    });
    return { kind: "failed", reason: "unknown_market" };
  }
  const market = resolveMarket(sub.market);

  const product = getProduct(sub.productSlug as ProductSlug);
  if (!product) {
    await markStatus(db, {
      id: run.id,
      status: "failed",
      failureReason: `unknown_product_${sub.productSlug}`,
      finishedAt: getNow(),
      attemptCount: run.attemptCount + 1,
    });
    return { kind: "failed", reason: "unknown_product" };
  }

  const subtotal = sub.unitPrice * sub.quantity;
  const taxableBase = subtotal; // renewals carry no discount
  const tax = Math.round(taxableBase * market.taxRate);
  const shipping = market.shippingFlat;
  const total = taxableBase + tax + shipping;

  // 5. Charge. Stripe SDK gets `idempotencyKey: run.id` so retries collapse.
  let chargeResult;
  try {
    chargeResult = await gateway.chargeRecurring({
      customerRef,
      paymentMethodRef,
      amount: total,
      currency: market.currency,
      idempotencyKey: run.id,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message.slice(0, 200) : "gateway_threw";
    await markStatus(db, {
      id: run.id,
      status: "failed",
      failureReason: reason,
      finishedAt: getNow(),
      attemptCount: run.attemptCount + 1,
    });
    return { kind: "failed", reason };
  }

  if (chargeResult.status === "declined") {
    await markStatus(db, {
      id: run.id,
      status: "failed",
      failureReason: chargeResult.declineReason,
      finishedAt: getNow(),
      attemptCount: run.attemptCount + 1,
    });
    await updateStatus(db, { id: sub.id, status: "past_due" });
    return { kind: "failed", reason: chargeResult.declineReason };
  }

  // 6. Success — build renewal order rows directly. Renewal idempotency is
  //    keyed off the run id (matches the charge idempotencyKey).
  const order: NewOrder = {
    customerId: sub.customerId,
    market: market.id,
    currency: market.currency,
    subtotal,
    tax,
    shipping,
    total,
    discountAmount: 0,
    status: "paid",
    paymentProvider: gateway.name,
    paymentChargeId: chargeResult.chargeId,
    shippingAddress: sub.shippingAddress as Record<string, unknown>,
    idempotencyKey: `subrun_${run.id}`,
  };

  const orderItem: Omit<NewOrderItem, "orderId"> = {
    productSlug: sub.productSlug,
    name: product.name,
    unitPrice: sub.unitPrice,
    quantity: sub.quantity,
    isSubscription: true,
    intervalDays: sub.intervalDays,
    discountPct: product.subscriptionDiscounts[
      sub.intervalDays as 30 | 60 | 90
    ],
  };

  let persistedOrderId: string;
  try {
    const persisted = await persistOrder(db, {
      order,
      orderItems: [orderItem],
      subscriptions: [], // do NOT create a new sub — the existing one renews
      paymentAttempt: {
        provider: gateway.name,
        providerChargeId: chargeResult.chargeId,
        providerCustomerId: customerRef,
        amount: total,
        currency: market.currency,
        status: "succeeded",
      },
    });
    persistedOrderId = persisted.orderId;
  } catch (err) {
    // Charge succeeded but persistence failed — loud, ops-actionable case.
    // Mark the run failed but DO NOT past_due the sub (the customer was
    // charged successfully; manual reconciliation needed).
    const reason =
      err instanceof Error ? `persist_failed:${err.message.slice(0, 180)}` : "persist_failed";
    console.error("[subscription-cron] persist failed after charge succeeded:", err);
    await markStatus(db, {
      id: run.id,
      status: "failed",
      failureReason: reason,
      finishedAt: getNow(),
      attemptCount: run.attemptCount + 1,
    });
    return { kind: "failed", reason };
  }

  // 7. Advance subscription.nextBillingDate. The new value is built from the
  //    *previous* nextBillingDate, not `now`, so a missed cron day doesn't
  //    push every customer's billing schedule forward by that delay.
  const prev = new Date(`${sub.nextBillingDate}T00:00:00.000Z`);
  prev.setUTCDate(prev.getUTCDate() + sub.intervalDays);
  const newNextBillingDate = prev.toISOString().slice(0, 10);
  await updateStatus(db, { id: sub.id, nextBillingDate: newNextBillingDate });

  await markStatus(db, {
    id: run.id,
    status: "succeeded",
    orderId: persistedOrderId,
    finishedAt: getNow(),
    attemptCount: run.attemptCount + 1,
  });

  return { kind: "succeeded", orderId: persistedOrderId, chargeId: chargeResult.chargeId };
}
