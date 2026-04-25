import { pgTable, uuid, text, integer, timestamp, jsonb, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql, desc } from "drizzle-orm";
import { orders } from "./orders";
import { subscriptionRuns } from "./subscription-runs";

export const paymentAttempts = pgTable(
  "payment_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // XOR: exactly one of these is set. Enforced by check constraint below.
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
    subscriptionRunId: uuid("subscription_run_id").references(() => subscriptionRuns.id, {
      onDelete: "cascade",
    }),

    provider: text("provider").notNull(), // stripe | mercadopago | stub
    providerChargeId: text("provider_charge_id"),
    providerCustomerId: text("provider_customer_id"),

    amount: integer("amount").notNull(), // cents
    currency: text("currency").notNull(),

    // succeeded | failed | refunded | pending
    status: text("status").notNull(),
    failureCode: text("failure_code"),

    // Raw gateway response for debugging. MUST be redacted of PAN/CVV by caller.
    providerResponse: jsonb("provider_response"),

    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    parentXor: check(
      "payment_attempts_parent_xor",
      sql`(${t.orderId} IS NULL) <> (${t.subscriptionRunId} IS NULL)`,
    ),
    providerChargeUnique: uniqueIndex("payment_attempts_provider_charge_unique")
      .on(t.provider, t.providerChargeId)
      .where(sql`${t.providerChargeId} IS NOT NULL`),
    orderIdx: index("payment_attempts_order_id_idx").on(t.orderId),
    subRunIdx: index("payment_attempts_subscription_run_id_idx").on(t.subscriptionRunId),
    statusIdx: index("payment_attempts_status_attempted_at_idx").on(t.status, desc(t.attemptedAt)),
  }),
);

export type PaymentAttempt = typeof paymentAttempts.$inferSelect;
export type NewPaymentAttempt = typeof paymentAttempts.$inferInsert;
