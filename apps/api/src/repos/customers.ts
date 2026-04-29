import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { customers, type Customer } from "../db/schema/customers";

export interface UpsertCustomerInput {
  clerkUserId: string;
  email: string;
  market: string; // sets country on insert; preserved on subsequent upserts
}

/**
 * Idempotent upsert by clerk_user_id. On insert, sets country = market.
 * On conflict, updates only email + updated_at — country is NEVER
 * overwritten so a customer's country survives a market mismatch in
 * an incoming request.
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
      country: input.market,
    })
    .onConflictDoUpdate({
      target: customers.clerkUserId,
      set: {
        email: input.email,
        // country deliberately NOT updated here.
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!row) {
    throw new Error("upsertCustomerByClerkUserId returned no row");
  }
  return row;
}

/**
 * Upsert a guest customer (no Clerk account yet) by email.
 *
 * The schema requires `clerkUserId` to be NOT NULL + UNIQUE, so we fabricate
 * a deterministic synthetic id of the form `guest_<sha256(email).slice(0,32)>`.
 * This:
 *   - keeps the unique constraint usable (one row per email)
 *   - never collides with real Clerk ids (they start with `user_`)
 *   - is idempotent: same email → same row (subsequent guest checkouts upsert)
 *   - allows a future "claim guest cart" flow when the user signs up: lookup
 *     by email, swap clerk_user_id from the synthetic to the real one
 *
 * Note: email is lowercased before hashing so casing variations collapse.
 */
export async function upsertGuestCustomerByEmail(
  db: Db,
  input: { email: string; market: string },
): Promise<Customer> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const syntheticId = await guestClerkUserIdFromEmail(normalizedEmail);

  const [row] = await db
    .insert(customers)
    .values({
      clerkUserId: syntheticId,
      email: normalizedEmail,
      country: input.market,
    })
    .onConflictDoUpdate({
      target: customers.clerkUserId,
      set: {
        email: normalizedEmail,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!row) {
    throw new Error("upsertGuestCustomerByEmail returned no row");
  }
  return row;
}

/**
 * Deterministic synthetic clerk_user_id for a guest email.
 * Exported for tests; not part of the public surface.
 */
export async function guestClerkUserIdFromEmail(email: string): Promise<string> {
  const data = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `guest_${hex.slice(0, 32)}`;
}

/**
 * Persist the gateway-side credentials (Stripe Customer id + saved payment
 * method id) and stamp `recurring_consent_at` on a customer. Used after a
 * successful checkout that includes a subscription line — these credentials
 * are what the cron uses for off-session renewals.
 *
 * `gatewayCustomerIds` is merged: setting `stripe` doesn't clear `mercadopago`.
 *
 * If the customer already has values for these fields, they're overwritten —
 * the most recent successful checkout wins. We don't try to preserve old
 * payment methods because Stripe will drop the old PM at the next
 * customers.update if it isn't the default. (Phase 2.5 may add a list-of-PMs
 * column, but YAGNI for now.)
 */
export async function setGatewayCredentials(
  db: Db,
  input: {
    customerId: string;
    gatewayName: string;
    gatewayCustomerId: string;
    paymentMethodId: string;
    consentAt: Date;
  },
): Promise<void> {
  const [existing] = await db
    .select({ ids: customers.gatewayCustomerIds })
    .from(customers)
    .where(eq(customers.id, input.customerId))
    .limit(1);
  if (!existing) {
    throw new Error(`setGatewayCredentials: customer ${input.customerId} not found`);
  }
  const merged = {
    ...(existing.ids ?? {}),
    [input.gatewayName]: input.gatewayCustomerId,
  };
  await db
    .update(customers)
    .set({
      gatewayCustomerIds: merged as { stripe?: string; mercadopago?: string },
      defaultCardId: input.paymentMethodId,
      recurringConsentAt: input.consentAt,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, input.customerId));
}

export async function getCustomerById(db: Db, id: string): Promise<Customer | undefined> {
  const [row] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return row;
}
