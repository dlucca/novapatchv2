import type { Db } from "../db";
import type { PaymentGateway } from "../lib/payment-gateway";
import { getNextRunsForProcessing } from "../repos/subscription-runs";
import {
  materializeDueSubscriptions,
  type MaterializeReport,
} from "./materialize-due-subscriptions";
import {
  processSubscriptionRun,
  type ProcessRunOutcome,
} from "./process-subscription-run";

export interface RunCronInput {
  db: Db;
  gateway: PaymentGateway;
  now: Date;
  /** Hard cap on runs processed per invocation. Defaults to 100. */
  maxRuns?: number;
}

export interface RunCronReport {
  materialize: MaterializeReport;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  outcomes: Array<{ runId: string; outcome: ProcessRunOutcome }>;
}

/**
 * Top-level orchestrator for the subscription cron. Two phases:
 *
 *   1. Materialize: insert `pending` rows for every active subscription due
 *      today (idempotent via the unique index).
 *
 *   2. Process: pick up pending rows and charge each through the gateway,
 *      persisting the renewal order on success. Hard-capped per invocation.
 *
 * Returns a structured report so the trigger endpoint can echo it back to
 * the operator/scheduler logs.
 */
export async function runSubscriptionCron(input: RunCronInput): Promise<RunCronReport> {
  const { db, gateway, now } = input;
  const maxRuns = input.maxRuns ?? 100;

  const materialize = await materializeDueSubscriptions(db, now);

  const pending = await getNextRunsForProcessing(db, { now, limit: maxRuns });

  const outcomes: RunCronReport["outcomes"] = [];
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  for (const run of pending) {
    const outcome = await processSubscriptionRun({ db, gateway, getNow: () => now }, run);
    outcomes.push({ runId: run.id, outcome });
    if (outcome.kind === "succeeded") succeeded += 1;
    else if (outcome.kind === "failed") failed += 1;
    else skipped += 1;
  }

  return {
    materialize,
    processed: pending.length,
    succeeded,
    failed,
    skipped,
    outcomes,
  };
}
