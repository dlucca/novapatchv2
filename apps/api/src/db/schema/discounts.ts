import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { influencers } from "./influencers";
import { orders } from "./orders";
import { customers } from "./customers";

export const discountCodes = pgTable("discount_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(), // store lowercased for case-insensitive lookup
  kind: text("kind").notNull(), // 'promo' | 'influencer'
  influencerId: uuid("influencer_id").references(() => influencers.id), // only when kind='influencer'

  discountPct: integer("discount_pct").notNull(), // % off subtotal
  markets: text("markets").array().notNull(), // e.g. ['mx'] or ['mx','br']
  appliesTo: text("applies_to").notNull(), // 'all' | 'once' | 'subscription'

  minSubtotal: integer("min_subtotal"), // cents
  maxUses: integer("max_uses"), // global cap
  maxUsesPerCustomer: integer("max_uses_per_customer"),
  timesUsed: integer("times_used").notNull().default(0),

  validFrom: timestamp("valid_from", { withTimezone: true }),
  validUntil: timestamp("valid_until", { withTimezone: true }),

  status: text("status").notNull().default("active"), // 'active' | 'disabled'

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const discountRedemptions = pgTable("discount_redemptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  discountCodeId: uuid("discount_code_id")
    .notNull()
    .references(() => discountCodes.id),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id),
  influencerId: uuid("influencer_id").references(() => influencers.id), // denormalized

  discountAmount: integer("discount_amount").notNull(), // cents (snapshot)
  commissionAmount: integer("commission_amount"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DiscountCode = typeof discountCodes.$inferSelect;
export type NewDiscountCode = typeof discountCodes.$inferInsert;
export type DiscountRedemption = typeof discountRedemptions.$inferSelect;
export type NewDiscountRedemption = typeof discountRedemptions.$inferInsert;
