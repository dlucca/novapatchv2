import type { Subscription } from "../db/schema/subscriptions";

export type SubscriptionStatus =
  | "active"
  | "paused"
  | "canceled"
  | "past_due"
  | "delayed_oos";

export type SubscriptionAction = "pause" | "resume" | "cancel" | "frequency";

export type SubscriptionInterval = 30 | 60 | 90;

export interface SubscriptionUpdate {
  status?: SubscriptionStatus;
  intervalDays?: SubscriptionInterval;
  nextBillingDate?: string;
  canceledAt?: Date;
}

export type ApplySubscriptionActionResult =
  | { ok: true; update: SubscriptionUpdate }
  | {
      ok: false;
      reason: "subscription_invalid_state";
      currentStatus: SubscriptionStatus;
      action: SubscriptionAction;
    };

export interface ApplySubscriptionActionInput {
  sub: Subscription;
  action: SubscriptionAction;
  getNow: () => Date;
  intervalDays?: SubscriptionInterval;
}

function addDaysUtc(base: Date, days: number): string {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function reject(
  currentStatus: SubscriptionStatus,
  action: SubscriptionAction,
): ApplySubscriptionActionResult {
  return { ok: false, reason: "subscription_invalid_state", currentStatus, action };
}

export function applySubscriptionAction(
  input: ApplySubscriptionActionInput,
): ApplySubscriptionActionResult {
  const status = input.sub.status as SubscriptionStatus;

  if (input.action === "pause") {
    if (status !== "active") return reject(status, "pause");
    return { ok: true, update: { status: "paused" } };
  }

  if (input.action === "resume") {
    if (status !== "paused") return reject(status, "resume");
    return {
      ok: true,
      update: {
        status: "active",
        nextBillingDate: addDaysUtc(input.getNow(), input.sub.intervalDays),
      },
    };
  }

  if (input.action === "cancel") {
    if (status === "canceled") return reject(status, "cancel");
    return {
      ok: true,
      update: { status: "canceled", canceledAt: input.getNow() },
    };
  }

  // action === "frequency"
  if (input.intervalDays === undefined) {
    throw new Error("applySubscriptionAction: intervalDays is required for frequency action");
  }
  if (status !== "active" && status !== "paused") {
    return reject(status, "frequency");
  }
  return {
    ok: true,
    update: {
      intervalDays: input.intervalDays,
      nextBillingDate: addDaysUtc(input.getNow(), input.intervalDays),
    },
  };
}
