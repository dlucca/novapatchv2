import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { customers } from "./customers";
import { discountCodes } from "./discounts";
import { influencers } from "./influencers";

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),

    market: text("market").notNull(),
    currency: text("currency").notNull(),

    subtotal: integer("subtotal").notNull(),
    tax: integer("tax").notNull(),
    shipping: integer("shipping").notNull(),
    total: integer("total").notNull(),
    discountAmount: integer("discount_amount").notNull().default(0),

    discountCodeId: uuid("discount_code_id").references(() => discountCodes.id),
    influencerId: uuid("influencer_id").references(() => influencers.id),

    status: text("status").notNull(),
    paymentProvider: text("payment_provider").notNull(),
    paymentChargeId: text("payment_charge_id"),

    shippingAddress: jsonb("shipping_address").notNull(),

    enviaLabelUrl: text("envia_label_url"),
    enviaTracking: text("envia_tracking"),

    idempotencyKey: text("idempotency_key"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idempotencyKeyUnique: uniqueIndex("orders_idempotency_key_unique")
      .on(t.idempotencyKey)
      .where(sql`${t.idempotencyKey} IS NOT NULL`),
  }),
);

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),

  productSlug: text("product_slug").notNull(),
  name: text("name").notNull(),
  unitPrice: integer("unit_price").notNull(),
  quantity: integer("quantity").notNull(),

  isSubscription: boolean("is_subscription").notNull().default(false),
  intervalDays: integer("interval_days"),
  discountPct: integer("discount_pct"),
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
