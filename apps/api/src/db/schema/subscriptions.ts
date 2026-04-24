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
  unitPrice: integer("unit_price").notNull(), // cents (already includes frequency discount)
  quantity: integer("quantity").notNull(),

  market: text("market").notNull(),
  currency: text("currency").notNull(),

  status: text("status").notNull(), // active|paused|canceled|past_due|delayed_oos
  nextBillingDate: date("next_billing_date").notNull(),

  shippingAddress: jsonb("shipping_address").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
});

export const subscriptionBillings = pgTable("subscription_billings", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscriptionId: uuid("subscription_id")
    .notNull()
    .references(() => subscriptions.id, { onDelete: "cascade" }),
  orderId: uuid("order_id").references(() => orders.id), // null until charge succeeds

  cycleNumber: integer("cycle_number").notNull(), // 1-indexed
  attemptNumber: integer("attempt_number").notNull().default(1), // dunning retry count

  amount: integer("amount").notNull(),
  status: text("status").notNull(), // success|failed|oos

  chargedAt: timestamp("charged_at", { withTimezone: true }).notNull().defaultNow(),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type SubscriptionBilling = typeof subscriptionBillings.$inferSelect;
export type NewSubscriptionBilling = typeof subscriptionBillings.$inferInsert;
