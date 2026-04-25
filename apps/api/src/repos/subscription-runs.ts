import { and, asc, eq, lte } from "drizzle-orm";
import type { Db } from "../db";
import {
  subscriptionRuns,
  type SubscriptionRun,
  type NewSubscriptionRun,
} from "../db/schema/subscription-runs";

export type SubscriptionRunStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "abandoned";

export interface MaterializeRunInput {
  subscriptionId: string;
  cycleNumber: number;
  scheduledFor: Date;
}

export interface MaterializeRunOutput {
  id: string;
  inserted: boolean;
}

/**
 * Idempotent insert keyed by (subscriptionId, scheduledFor). If a row already
 * exists for that pair, returns its id with inserted:false. Used by the
 * worker's "materialize due cycles" cron.
 */
export async function materializeRun(
  db: Db,
  input: MaterializeRunInput,
): Promise<MaterializeRunOutput> {
  const values: NewSubscriptionRun = {
    subscriptionId: input.subscriptionId,
    cycleNumber: input.cycleNumber,
    scheduledFor: input.scheduledFor,
  };
  const inserted = await db
    .insert(subscriptionRuns)
    .values(values)
    .onConflictDoNothing({
      target: [subscriptionRuns.subscriptionId, subscriptionRuns.scheduledFor],
    })
    .returning({ id: subscriptionRuns.id });

  if (inserted[0]) {
    return { id: inserted[0].id, inserted: true };
  }

  // Conflict path: fetch the existing row's id.
  const [existing] = await db
    .select({ id: subscriptionRuns.id })
    .from(subscriptionRuns)
    .where(
      and(
        eq(subscriptionRuns.subscriptionId, input.subscriptionId),
        eq(subscriptionRuns.scheduledFor, input.scheduledFor),
      ),
    )
    .limit(1);
  if (!existing) {
    throw new Error("materializeRun: conflict path could not find existing row");
  }
  return { id: existing.id, inserted: false };
}

export interface GetNextRunsInput {
  now: Date;
  limit: number;
}

/**
 * Returns runs whose status is 'pending' and scheduledFor <= now, ordered
 * by scheduledFor ascending. Plain SELECT — locking semantics
 * (FOR UPDATE SKIP LOCKED) are added by the worker (Plan #8) when it
 * actually processes them.
 */
export async function getNextRunsForProcessing(
  db: Db,
  input: GetNextRunsInput,
): Promise<SubscriptionRun[]> {
  return await db
    .select()
    .from(subscriptionRuns)
    .where(
      and(
        eq(subscriptionRuns.status, "pending"),
        lte(subscriptionRuns.scheduledFor, input.now),
      ),
    )
    .orderBy(asc(subscriptionRuns.scheduledFor))
    .limit(input.limit);
}

export interface MarkStatusInput {
  id: string;
  status: SubscriptionRunStatus;
  orderId?: string;
  failureReason?: string;
  startedAt?: Date;
  finishedAt?: Date;
  attemptCount?: number;
}

/**
 * Updates a run's status + any of the optional denormalized fields. Caller
 * is responsible for passing fields appropriate to the target status (e.g.
 * `orderId` only on succeeded; `failureReason` only on failed/abandoned).
 */
export async function markStatus(db: Db, input: MarkStatusInput): Promise<void> {
  const set: Partial<NewSubscriptionRun> = { status: input.status };
  if (input.orderId !== undefined) set.orderId = input.orderId;
  if (input.failureReason !== undefined) set.failureReason = input.failureReason;
  if (input.startedAt !== undefined) set.startedAt = input.startedAt;
  if (input.finishedAt !== undefined) set.finishedAt = input.finishedAt;
  if (input.attemptCount !== undefined) set.attemptCount = input.attemptCount;
  await db.update(subscriptionRuns).set(set).where(eq(subscriptionRuns.id, input.id));
}
