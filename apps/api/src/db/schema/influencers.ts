import { pgTable, uuid, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const influencers = pgTable("influencers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  instagramHandle: text("instagram_handle"),

  commissionPct: integer("commission_pct").notNull(), // % per attributed order
  status: text("status").notNull(), // active|paused|terminated
  payoutMethod: jsonb("payout_method"),
  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Influencer = typeof influencers.$inferSelect;
export type NewInfluencer = typeof influencers.$inferInsert;
