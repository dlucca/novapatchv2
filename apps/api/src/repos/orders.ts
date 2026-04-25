import { desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../db";
import { orders, orderItems, type NewOrder, type NewOrderItem, type Order, type OrderItem } from "../db/schema/orders";
import { subscriptions, type NewSubscription, type Subscription } from "../db/schema/subscriptions";
import { discountCodes, discountRedemptions } from "../db/schema/discounts";
import { paymentAttempts } from "../db/schema/payment-attempts";

export interface PersistOrderInput {
  order: NewOrder;
  orderItems: Omit<NewOrderItem, "orderId">[];
  subscriptions: Omit<NewSubscription, "originalOrderId">[];
  redemption?: {
    discountCodeId: string;
    customerId: string;
    discountAmount: number;
    influencerId: string | null;
    commissionAmount: number | null;
  };
  paymentAttempt: {
    provider: string;
    providerChargeId: string;
    providerCustomerId?: string;
    amount: number;
    currency: string;
    status: "succeeded" | "failed" | "refunded" | "pending";
    failureCode?: string;
    providerResponse?: unknown;
  };
}

export interface PersistOrderOutput {
  orderId: string;
  subscriptionIds: string[];
}

/**
 * Atomically writes an order + items + optional redemption + subscriptions.
 * If any step throws, the whole transaction rolls back.
 *
 * The caller is expected to have already charged the gateway — this repo
 * assumes "paid" state. The builder in `services/create-order.ts` constructs
 * the input; see that file for the invariants.
 */
export async function persistOrder(
  db: Db,
  input: PersistOrderInput,
): Promise<PersistOrderOutput> {
  return await db.transaction(async (tx) => {
    const [order] = await tx.insert(orders).values(input.order).returning();
    if (!order) throw new Error("persistOrder: order insert returned no row");

    if (input.orderItems.length > 0) {
      await tx.insert(orderItems).values(
        input.orderItems.map((i) => ({ ...i, orderId: order.id })),
      );
    }

    if (input.redemption) {
      await tx.insert(discountRedemptions).values({
        ...input.redemption,
        orderId: order.id,
      });
      await tx
        .update(discountCodes)
        .set({ timesUsed: sql`${discountCodes.timesUsed} + 1` })
        .where(eq(discountCodes.id, input.redemption.discountCodeId));
    }

    const subscriptionIds: string[] = [];
    for (const sub of input.subscriptions) {
      const [row] = await tx
        .insert(subscriptions)
        .values({ ...sub, originalOrderId: order.id })
        .returning({ id: subscriptions.id });
      if (!row) throw new Error("persistOrder: subscription insert returned no row");
      subscriptionIds.push(row.id);
    }

    await tx.insert(paymentAttempts).values({
      orderId: order.id,
      provider: input.paymentAttempt.provider,
      providerChargeId: input.paymentAttempt.providerChargeId,
      providerCustomerId: input.paymentAttempt.providerCustomerId ?? null,
      amount: input.paymentAttempt.amount,
      currency: input.paymentAttempt.currency,
      status: input.paymentAttempt.status,
      failureCode: input.paymentAttempt.failureCode ?? null,
      providerResponse: input.paymentAttempt.providerResponse ?? null,
    });

    return { orderId: order.id, subscriptionIds };
  });
}

export interface OrderWithItems {
  order: Order;
  items: OrderItem[];
}

/**
 * Lists a customer's orders with their items embedded, sorted by createdAt DESC.
 * Two queries (one for orders, one for items), fanned out in-memory. For v1
 * volumes this is fine; a JOIN would add complexity without a measurable win.
 */
export async function listOrdersWithItemsByCustomerId(
  db: Db,
  customerId: string,
): Promise<OrderWithItems[]> {
  const orderRows = await db
    .select()
    .from(orders)
    .where(eq(orders.customerId, customerId))
    .orderBy(desc(orders.createdAt));
  if (orderRows.length === 0) return [];

  const ids = orderRows.map((o) => o.id);
  const items = await db
    .select()
    .from(orderItems)
    .where(inArray(orderItems.orderId, ids));
  const byOrderId = new Map<string, OrderItem[]>();
  for (const it of items) {
    const bucket = byOrderId.get(it.orderId) ?? [];
    bucket.push(it);
    byOrderId.set(it.orderId, bucket);
  }
  return orderRows.map((o) => ({ order: o, items: byOrderId.get(o.id) ?? [] }));
}

export interface OrderWithRelations {
  order: Order;
  items: OrderItem[];
  subscriptions: Subscription[];
}

/**
 * Lookup for idempotent replay. Returns undefined when no order has the key.
 * Returns the order + items + subscriptions originated by that order.
 */
export async function findOrderByIdempotencyKey(
  db: Db,
  key: string,
): Promise<OrderWithRelations | undefined> {
  const [order] = await db.select().from(orders).where(eq(orders.idempotencyKey, key)).limit(1);
  if (!order) return undefined;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const subs = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.originalOrderId, order.id));
  return { order, items, subscriptions: subs };
}
