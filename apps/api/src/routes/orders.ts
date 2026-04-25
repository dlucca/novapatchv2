import { Hono } from "hono";
import type { Db } from "../db";
import type { ClerkUserClient } from "../lib/clerk";
import { upsertCustomerByClerkUserId } from "../repos/customers";
import {
  listOrdersWithItemsByCustomerId,
  type OrderWithItems,
} from "../repos/orders";
import type { Order, OrderItem } from "../db/schema/orders";

export interface OrdersRoutesDeps {
  db: Db;
  userClient: ClerkUserClient;
}

function serializeItem(i: OrderItem) {
  return {
    productSlug: i.productSlug,
    name: i.name,
    unitPrice: i.unitPrice,
    quantity: i.quantity,
    isSubscription: i.isSubscription,
    intervalDays: i.intervalDays,
  };
}

function serializeOrder(o: Order, items: OrderItem[]) {
  return {
    id: o.id,
    createdAt: o.createdAt.toISOString(),
    status: o.status,
    market: o.market,
    currency: o.currency,
    subtotal: o.subtotal,
    discountAmount: o.discountAmount,
    tax: o.tax,
    shipping: o.shipping,
    total: o.total,
    paymentChargeId: o.paymentChargeId,
    items: items.map(serializeItem),
  };
}

export function createOrdersRoutes(deps: OrdersRoutesDeps): Hono {
  const r = new Hono();

  r.get("/", async (c) => {
    const clerkUserId = c.get("clerkUserId");
    const { email } = await deps.userClient.getUser(clerkUserId);
    const customer = await upsertCustomerByClerkUserId(deps.db, {
      clerkUserId,
      email,
      market: "mx",
    });
    const rows: OrderWithItems[] = await listOrdersWithItemsByCustomerId(
      deps.db,
      customer.id,
    );
    return c.json({
      orders: rows.map((r) => serializeOrder(r.order, r.items)),
    });
  });

  return r;
}
