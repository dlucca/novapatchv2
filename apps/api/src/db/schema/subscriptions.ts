import { pgTable, uuid, text, integer, timestamp, date, jsonb } from "drizzle-orm/pg-core";
import { customers } from "./customers";
import { orders } from "./orders";

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id),
  originalOrderId: uuid("original_order_id")
    .notNull()
    .references(() => orders.id),

  productSlug: text("product_slug").notNull(),
  intervalDays: integer("interval_days").notNull(), // 30 | 60 | 90
  unitPrice: integer("unit_price").notNull(),
  quantity: integer("quantity").notNull(),

  market: text("market").notNull(),
  currency: text("currency").notNull(),

  status: text("status").notNull(), // active|paused|canceled|past_due|delayed_oos
  nextBillingDate: date("next_billing_date").notNull(),

  shippingAddress: jsonb("shipping_address").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
