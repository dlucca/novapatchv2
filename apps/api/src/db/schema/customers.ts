import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  email: text("email").notNull(),

  country: text("country").notNull().default("mx"),

  // JSONB shape: { stripe?: string, mercadopago?: string }
  // Empty object default avoids null checks at read time.
  gatewayCustomerIds: jsonb("gateway_customer_ids")
    .$type<{ stripe?: string; mercadopago?: string }>()
    .notNull()
    .default(sql`'{}'::jsonb`),

  // JSONB shape matches orders.shipping_address:
  //   { line1, line2?, city, state, postalCode, country }
  defaultShippingAddress: jsonb("default_shipping_address").$type<{
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  }>(),

  // Vault state for recurring billing.
  defaultCardId: text("default_card_id"),
  defaultCardBrand: text("default_card_brand"),
  defaultCardLast4: text("default_card_last4"),
  recurringConsentAt: timestamp("recurring_consent_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
