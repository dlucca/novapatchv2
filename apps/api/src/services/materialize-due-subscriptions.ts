import type { Db } from "../db";
import {
  findDueActiveSubscriptions,
} from "../repos/subscriptions";
import {
  countRunsForSubscription,
  materializeRun,
} from "../repos/subscription-runs";

export interface MaterializeReport {
  subscriptionsConsidered: number;
  runsCreated: number;
  runsAlreadyExisted: number;
}

/**
 * Materializer step of the subscription cron.
 *
 * For each `active` subscription whose `next_billing_date <= today`, insert a
 * `pending` row in `subscription_runs` keyed by (subscription_id,
 * scheduledFor=next_billing_date) — the unique index guarantees idempotency
 * across cron retries within the same day.
 *
 * `cycleNumber` is computed as `count(existing runs) + 1` so cycles are
 * 1-indexed and stable. The signup order itself is cycle 0 conceptually
 * (not stored as a run).
 *
 * This step does NOT charge anything. The processor step picks up `pending`
 * rows and performs the actual recurring charge.
 */
export async function materializeDueSubscriptions(
  db: Db,
  now: Date,
): Promise<MaterializeReport> {
  // Treat `next_billing_date` as a calendar date (no timezone). UTC keeps the
  // boundary deterministic across server timezones.
  const asOfDate = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const due = await findDueActiveSubscriptions(db, asOfDate);

  let runsCreated = 0;
  let runsAlreadyExisted = 0;

  for (const sub of due) {
    const existingRuns = await countRunsForSubscription(db, sub.id);
    const cycleNumber = existingRuns + 1;
    // Schedule the run at the start of the billing date in UTC. The unique
    // (subscriptionId, scheduledFor) index makes the operation idempotent
    // even if the cron fires multiple times before the run is processed.
    const scheduledFor = new Date(`${sub.nextBillingDate}T00:00:00.000Z`);

    const result = await materializeRun(db, {
      subscriptionId: sub.id,
      cycleNumber,
      scheduledFor,
    });
    if (result.inserted) runsCreated += 1;
    else runsAlreadyExisted += 1;
  }

  return {
    subscriptionsConsidered: due.length,
    runsCreated,
    runsAlreadyExisted,
  };
}
