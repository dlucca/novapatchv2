import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { customers } from "./customers";
import { discountCodes } from "./discounts";
import { influencers } from "./influencers";

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id),

  market: text("market").notNull(), // 'mx' | 'br' | 'ar' | 'cl' | 'co'
  currency: text("currency").notNull(),

  subtotal: integer("subtotal").notNull(), // cents
  tax: integer("tax").notNull(),
  shipping: integer("shipping").notNull(),
  total: integer("total").notNull(),
  discountAmount: integer("discount_amount").notNull().default(0),

  discountCodeId: uuid("discount_code_id").references(() => discountCodes.id),
  influencerId: uuid("influencer_id").references(() => influencers.id),

  status: text("status").notNull(), // pending|paid|fulfilled|failed|refunded
  paymentProvider: text("payment_provider").notNull(), // openpay|mercadopago
  paymentChargeId: text("payment_charge_id"),

  shippingAddress: jsonb("shipping_address").notNull(),

  enviaLabelUrl: text("envia_label_url"),
  enviaTracking: text("envia_tracking"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),

  productSlug: text("product_slug").notNull(),
  name: text("name").notNull(), // snapshot
  unitPrice: integer("unit_price").notNull(), // cents, snapshot
  quantity: integer("quantity").notNull(),

  isSubscription: boolean("is_subscription").notNull().default(false),
  intervalDays: integer("interval_days"), // 30 | 60 | 90
  discountPct: integer("discount_pct"), // 20 | 15 | 10
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
