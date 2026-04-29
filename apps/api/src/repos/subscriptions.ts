import { and, desc, eq, lte } from "drizzle-orm";
import type { Db } from "../db";
import { subscriptions, type Subscription } from "../db/schema/subscriptions";
import type { SubscriptionInterval, SubscriptionStatus } from "../services/subscription-actions";

/**
 * Returns all `active` subscriptions whose `next_billing_date` is on or
 * before the given date (YYYY-MM-DD string, inclusive). Used by the
 * materializer step of the subscription cron.
 *
 * `next_billing_date` is a `date` column (no timezone) — pass a YYYY-MM-DD
 * string. `paused`, `canceled`, `past_due`, and `delayed_oos` rows are
 * excluded; the cron only acts on `active`.
 */
export async function findDueActiveSubscriptions(
  db: Db,
  asOfDate: string,
): Promise<Subscription[]> {
  return await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, "active"),
        lte(subscriptions.nextBillingDate, asOfDate),
      ),
    );
}

export async function listByCustomerId(db: Db, customerId: string): Promise<Subscription[]> {
  return await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.customerId, customerId))
    .orderBy(desc(subscriptions.createdAt));
}

export interface GetByIdForCustomerInput {
  id: string;
  customerId: string;
}

/**
 * Returns the subscription when it exists AND belongs to the given customer.
 * Returns undefined in every other case — same response for "doesn't exist"
 * and "exists but isn't yours" so routes can translate to a uniform 404.
 */
export async function getByIdForCustomer(
  db: Db,
  { id, customerId }: GetByIdForCustomerInput,
): Promise<Subscription | undefined> {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.id, id), eq(subscriptions.customerId, customerId)))
    .limit(1);
  return row;
}

export interface UpdateStatusInput {
  id: string;
  status?: SubscriptionStatus;
  intervalDays?: SubscriptionInterval;
  nextBillingDate?: string;
  canceledAt?: Date;
}

/**
 * Partial update — only the provided fields are written. `updatedAt` is
 * advanced by the schema-level $onUpdate hook, but we set it explicitly
 * as well because onConflict/update paths sometimes miss it in Drizzle.
 */
export async function updateStatus(
  db: Db,
  input: UpdateStatusInput,
): Promise<Subscription> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (input.status !== undefined) set.status = input.status;
  if (input.intervalDays !== undefined) set.intervalDays = input.intervalDays;
  if (input.nextBillingDate !== undefined) set.nextBillingDate = input.nextBillingDate;
  if (input.canceledAt !== undefined) set.canceledAt = input.canceledAt;

  const [row] = await db
    .update(subscriptions)
    .set(set)
    .where(eq(subscriptions.id, input.id))
    .returning();
  if (!row) throw new Error(`updateStatus: no subscription with id ${input.id}`);
  return row;
}
