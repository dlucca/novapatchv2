import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  email: text("email").notNull(),

  openpayCustomerId: text("openpay_customer_id"),
  mercadopagoCustomerId: text("mercadopago_customer_id"),

  // Vault state for recurring billing. See spec: "Recurring Billing Architecture".
  defaultCardId: text("default_card_id"),
  defaultCardBrand: text("default_card_brand"),
  defaultCardLast4: text("default_card_last4"),
  recurringConsentAt: timestamp("recurring_consent_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
