import { pgTable, uuid, text, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { subscriptions } from "./subscriptions";
import { orders } from "./orders";

export const subscriptionRuns = pgTable(
  "subscription_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),

    cycleNumber: integer("cycle_number").notNull(), // 1-indexed
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),

    // pending | processing | succeeded | failed | abandoned
    status: text("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),

    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),

    orderId: uuid("order_id").references(() => orders.id),
    failureReason: text("failure_reason"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    subRunSubScheduledUnique: uniqueIndex("subscription_runs_sub_scheduled_unique").on(
      t.subscriptionId,
      t.scheduledFor,
    ),
    subRunStatusScheduledIdx: index("subscription_runs_status_scheduled_for_idx").on(
      t.status,
      t.scheduledFor,
    ),
    subRunSubIdx: index("subscription_runs_subscription_id_idx").on(t.subscriptionId),
  }),
);

export type SubscriptionRun = typeof subscriptionRuns.$inferSelect;
export type NewSubscriptionRun = typeof subscriptionRuns.$inferInsert;
