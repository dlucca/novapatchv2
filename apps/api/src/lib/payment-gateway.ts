export interface ChargeInput {
  token: string;
  amount: number; // integer cents
  currency: string;
  deviceSessionId?: string;
  customerRef?: string;
}

export interface ChargeSucceeded {
  chargeId: string;
  status: "succeeded";
}

export interface ChargeDeclined {
  chargeId: string;
  status: "declined";
  declineReason: string;
}

export type ChargeResult = ChargeSucceeded | ChargeDeclined;

/**
 * Input for an off-session, merchant-initiated recurring charge (MIT).
 *
 * Unlike `ChargeInput` (which validates an existing customer-confirmed
 * PaymentIntent), this creates and confirms a fresh charge using a saved
 * payment method that the customer previously authorized for off-session
 * use. Stripe equivalent:
 *   paymentIntents.create({ customer, payment_method, off_session: true, confirm: true })
 */
export interface RecurringChargeInput {
  /** Provider customer id (e.g. Stripe `cus_XXX`). Required for off-session. */
  customerRef: string;
  /** Provider payment method id (e.g. Stripe `pm_XXX`) — the saved card. */
  paymentMethodRef: string;
  amount: number; // integer cents
  currency: string;
  /** Stable id used by the gateway for idempotency on retries (e.g. subscription_run id). */
  idempotencyKey: string;
}

/**
 * Stable provider identifier — must match `PaymentProvider` in
 * `repos/payment-attempts.ts` so the route can stamp it directly on
 * `payment_attempts.provider` without a cast.
 */
export type PaymentGatewayName = "stripe" | "mercadopago" | "stub";

export interface PaymentGateway {
  /** Used for `orders.payment_provider` and `payment_attempts.provider`. */
  readonly name: PaymentGatewayName;
  /** Customer-initiated charge (CIT). Validates a confirmed PaymentIntent. */
  charge(input: ChargeInput): Promise<ChargeResult>;
  /**
   * Merchant-initiated recurring charge (MIT). Creates and confirms a fresh
   * charge using a saved customer + payment method. Used by the subscription
   * cron worker.
   *
   * Implementations MAY return a `declined` ChargeResult when the gateway
   * reports a soft decline (insufficient funds, expired card, authentication
   * required) — the worker treats those as recoverable and marks the
   * subscription `past_due`. They SHOULD throw on transient/network errors
   * so the worker can retry the run.
   */
  chargeRecurring(input: RecurringChargeInput): Promise<ChargeResult>;
}

export type StubOutcome = "succeeded" | "declined" | "throw";

export interface CreateStubGatewayOpts {
  defaultOutcome?: StubOutcome;
  outcomeByToken?: Record<string, StubOutcome>;
  /**
   * Override outcome by recurring idempotency key (subscription_run id).
   * Falls back to `defaultRecurringOutcome` then `defaultOutcome`.
   */
  outcomeByIdempotencyKey?: Record<string, StubOutcome>;
  /** Default outcome for `chargeRecurring`. Falls back to `defaultOutcome`. */
  defaultRecurringOutcome?: StubOutcome;
  declineReason?: string;
}

/**
 * Deterministic in-memory gateway for tests. Semantics:
 *   - "succeeded" → returns {chargeId, status: "succeeded"}
 *   - "declined"  → returns {chargeId, status: "declined", declineReason}
 *   - "throw"     → throws Error("gateway timeout")
 *
 * `charge()` consults `outcomeByToken` then `defaultOutcome`.
 * `chargeRecurring()` consults `outcomeByIdempotencyKey` then
 * `defaultRecurringOutcome` then `defaultOutcome`.
 * The default default is "succeeded".
 */
export function createStubGateway(opts: CreateStubGatewayOpts): PaymentGateway {
  const defaultOutcome = opts.defaultOutcome ?? "succeeded";
  const declineReason = opts.declineReason ?? "test_declined";
  const byToken = opts.outcomeByToken ?? {};
  const byIdempotencyKey = opts.outcomeByIdempotencyKey ?? {};
  const defaultRecurring = opts.defaultRecurringOutcome ?? defaultOutcome;

  function applyOutcome(outcome: StubOutcome): ChargeResult {
    if (outcome === "throw") {
      throw new Error("gateway timeout");
    }
    const chargeId = `stub_${crypto.randomUUID()}`;
    if (outcome === "declined") {
      return { chargeId, status: "declined", declineReason };
    }
    return { chargeId, status: "succeeded" };
  }

  return {
    name: "stub",
    async charge(input) {
      const outcome = byToken[input.token] ?? defaultOutcome;
      return applyOutcome(outcome);
    },
    async chargeRecurring(input) {
      const outcome = byIdempotencyKey[input.idempotencyKey] ?? defaultRecurring;
      return applyOutcome(outcome);
    },
  };
}
