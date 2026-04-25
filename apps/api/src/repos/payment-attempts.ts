import { and, eq } from "drizzle-orm";
import type { Db } from "../db";
import {
  paymentAttempts,
  type PaymentAttempt,
} from "../db/schema/payment-attempts";

export type PaymentAttemptStatus = "succeeded" | "failed" | "refunded" | "pending";
export type PaymentProvider = "stripe" | "mercadopago" | "stub";

interface CommonAttemptFields {
  provider: PaymentProvider;
  providerChargeId?: string;
  providerCustomerId?: string;
  amount: number;
  currency: string;
  status: PaymentAttemptStatus;
  failureCode?: string;
  providerResponse?: unknown;
}

export type RecordAttemptInput =
  | (CommonAttemptFields & { orderId: string; subscriptionRunId?: never })
  | (CommonAttemptFields & { subscriptionRunId: string; orderId?: never });

/**
 * Inserts a single payment_attempts row. The TS overload requires exactly
 * one of `orderId` or `subscriptionRunId`. The DB enforces this at the
 * row level via a CHECK constraint as a safety net.
 *
 * `providerResponse` should be redacted of sensitive data (PAN, CVV) by
 * the caller before passing in. This repo does not redact.
 */
export async function recordAttempt(
  db: Db,
  input: RecordAttemptInput,
): Promise<{ id: string }> {
  const values = {
    orderId: "orderId" in input ? input.orderId : null,
    subscriptionRunId: "subscriptionRunId" in input ? input.subscriptionRunId : null,
    provider: input.provider,
    providerChargeId: input.providerChargeId ?? null,
    providerCustomerId: input.providerCustomerId ?? null,
    amount: input.amount,
    currency: input.currency,
    status: input.status,
    failureCode: input.failureCode ?? null,
    providerResponse: input.providerResponse ?? null,
  };
  const [row] = await db
    .insert(paymentAttempts)
    .values(values)
    .returning({ id: paymentAttempts.id });
  if (!row) throw new Error("recordAttempt: insert returned no row");
  return { id: row.id };
}

export interface FindByChargeIdInput {
  provider: PaymentProvider;
  providerChargeId: string;
}

/**
 * Webhook-handler lookup. Returns the attempt row matching the
 * (provider, providerChargeId) tuple, or null if none exists.
 */
export async function findByProviderChargeId(
  db: Db,
  input: FindByChargeIdInput,
): Promise<PaymentAttempt | null> {
  const [row] = await db
    .select()
    .from(paymentAttempts)
    .where(
      and(
        eq(paymentAttempts.provider, input.provider),
        eq(paymentAttempts.providerChargeId, input.providerChargeId),
      ),
    )
    .limit(1);
  return row ?? null;
}
