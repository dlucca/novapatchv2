import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { customers, type Customer } from "../db/schema/customers";

export interface UpsertCustomerInput {
  clerkUserId: string;
  email: string;
}

/**
 * Idempotent upsert by clerk_user_id. If a row exists, updates `email` +
 * `updated_at` and returns it; otherwise inserts and returns the new row.
 *
 * Keyed on clerk_user_id (not email) because email can change in Clerk but
 * the Clerk user id is stable for the account lifetime.
 */
export async function upsertCustomerByClerkUserId(
  db: Db,
  input: UpsertCustomerInput,
): Promise<Customer> {
  const [row] = await db
    .insert(customers)
    .values({
      clerkUserId: input.clerkUserId,
      email: input.email,
    })
    .onConflictDoUpdate({
      target: customers.clerkUserId,
      set: {
        email: input.email,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!row) {
    throw new Error("upsertCustomerByClerkUserId returned no row");
  }
  return row;
}

export async function getCustomerById(db: Db, id: string): Promise<Customer | undefined> {
  const [row] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return row;
}
