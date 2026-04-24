import { pgTable, uuid, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { influencers } from "./influencers";
import { orders } from "./orders";
import { customers } from "./customers";

export const discountCodes = pgTable(
  "discount_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    kind: text("kind").notNull(),
    influencerId: uuid("influencer_id").references(() => influencers.id),

    discountPct: integer("discount_pct").notNull(),
    markets: text("markets").array().notNull(),
    appliesTo: text("applies_to").notNull(),

    minSubtotal: integer("min_subtotal"),
    maxUses: integer("max_uses"),
    maxUsesPerCustomer: integer("max_uses_per_customer"),
    timesUsed: integer("times_used").notNull().default(0),

    validFrom: timestamp("valid_from", { withTimezone: true }),
    validUntil: timestamp("valid_until", { withTimezone: true }),

    status: text("status").notNull().default("active"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    lowerCodeUnique: uniqueIndex("discount_codes_lower_code_unique").on(sql`lower(${t.code})`),
  }),
);

export const discountRedemptions = pgTable(
  "discount_redemptions",
  {
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
    influencerId: uuid("influencer_id").references(() => influencers.id),

    discountAmount: integer("discount_amount").notNull(),
    commissionAmount: integer("commission_amount"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    codeCustomerOrderUnique: uniqueIndex("discount_redemptions_code_customer_order_unique").on(
      t.discountCodeId,
      t.customerId,
      t.orderId,
    ),
  }),
);

export type DiscountCode = typeof discountCodes.$inferSelect;
export type NewDiscountCode = typeof discountCodes.$inferInsert;
export type DiscountRedemption = typeof discountRedemptions.$inferSelect;
export type NewDiscountRedemption = typeof discountRedemptions.$inferInsert;
