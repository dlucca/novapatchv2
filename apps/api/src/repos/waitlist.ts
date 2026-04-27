import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { waitlistSignups, type WaitlistSignup } from "../db/schema/waitlist";

export interface UpsertWaitlistInput {
  email: string;            // pre-normalized lowercase by the route
  country: string;          // alpha-2 uppercase
  source: "unsupported_modal" | "navbar_selector";
  detectedCountry?: string;
  userAgent?: string;
}

export interface UpsertWaitlistOutput {
  id: string;
  inserted: boolean;
}

/**
 * Idempotent upsert by email. On conflict, overwrites country / source /
 * detectedCountry / userAgent / updatedAt. Returns inserted:true on insert,
 * false on update.
 */
export async function upsertWaitlist(
  db: Db,
  input: UpsertWaitlistInput,
): Promise<UpsertWaitlistOutput> {
  const values = {
    email: input.email,
    country: input.country,
    source: input.source,
    detectedCountry: input.detectedCountry ?? null,
    userAgent: input.userAgent ?? null,
  };

  const inserted = await db
    .insert(waitlistSignups)
    .values(values)
    .onConflictDoNothing({ target: waitlistSignups.email })
    .returning({ id: waitlistSignups.id });

  if (inserted[0]) {
    return { id: inserted[0].id, inserted: true };
  }

  // Conflict path: update + return existing id.
  const [row] = await db
    .update(waitlistSignups)
    .set({
      country: input.country,
      source: input.source,
      detectedCountry: input.detectedCountry ?? null,
      userAgent: input.userAgent ?? null,
      updatedAt: new Date(),
    })
    .where(eq(waitlistSignups.email, input.email))
    .returning({ id: waitlistSignups.id });

  if (!row) {
    throw new Error("upsertWaitlist: conflict path could not find existing row");
  }
  return { id: row.id, inserted: false };
}

export type { WaitlistSignup };
