import { eq, sql } from "drizzle-orm";
import type { Db } from "../db";
import { orders, orderItems, type NewOrder, type NewOrderItem, type Order, type OrderItem } from "../db/schema/orders";
import { subscriptions, type NewSubscription, type Subscription } from "../db/schema/subscriptions";
import { discountCodes, discountRedemptions } from "../db/schema/discounts";

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

    return { orderId: order.id, subscriptionIds };
  });
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
