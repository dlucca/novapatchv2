import Stripe from "stripe";
import type { PaymentGateway, ChargeResult, RecurringChargeInput } from "./payment-gateway";

/**
 * Minimal shape of a Stripe PaymentIntent we depend on.
 * Decoupled from the SDK so we can unit-test without the network.
 */
export interface StripePaymentIntentSnapshot {
  id: string;
  status: string;
  amount: number;
  currency: string;
  /** Populated on creation responses; may be present on retrieve too. */
  client_secret?: string | null;
  /** Stripe `last_payment_error.code` when status indicates a soft decline. */
  lastErrorCode?: string;
  /** Human-readable error message when present. */
  lastErrorMessage?: string;
}

export interface CreateRecurringChargeArgs {
  customer: string;
  payment_method: string;
  amount: number;
  currency: string;
  /** Stripe accepts an Idempotency-Key request header — passed by the caller. */
  idempotencyKey: string;
}

export interface StripePaymentIntentClient {
  retrieve(id: string): Promise<StripePaymentIntentSnapshot>;
  /** Creates and immediately confirms an off-session PI. */
  createOffSession(args: CreateRecurringChargeArgs): Promise<StripePaymentIntentSnapshot>;
}

export interface CreateStripeGatewayOpts {
  stripe: StripePaymentIntentClient;
}

/**
 * Stripe gateway adapter — confirm-existing-PaymentIntent flow.
 *
 * The frontend creates and confirms a PaymentIntent client-side. Once it
 * reaches `succeeded` it calls `POST /checkout` passing the PaymentIntent id
 * (e.g. "pi_3ABC...") as `paymentToken`. This adapter does NOT charge — it
 * retrieves the PI, verifies it actually succeeded, and verifies the amount
 * + currency match what the backend's quote produced. This protects against
 * a tampered client trying to pay $1 for a $1000 order.
 *
 * Mismatches (amount/currency) throw — they indicate tampering or a bug, and
 * the route layer maps thrown gateway errors to HTTP 502 (loud) rather than
 * silently declining.
 *
 * Non-succeeded statuses (`requires_payment_method`, `requires_action`,
 * `processing`, `canceled`, etc.) are mapped to `declined` with a reason of
 * `stripe_status_<status>` — this lets the client retry without the order
 * persisting.
 */
export function createStripeGateway(opts: CreateStripeGatewayOpts): PaymentGateway {
  const { stripe } = opts;

  return {
    name: "stripe",
    async charge(input): Promise<ChargeResult> {
      const pi = await stripe.retrieve(input.token);

      // Currency comparison is case-insensitive (Stripe returns lowercase, our
      // markets pkg may return upper- or lower-case depending on config).
      const piCurrency = pi.currency.toLowerCase();
      const expectedCurrency = input.currency.toLowerCase();

      if (pi.amount !== input.amount) {
        throw new Error(
          `stripe_amount_mismatch: expected ${input.amount}, got ${pi.amount} (pi=${pi.id})`,
        );
      }
      if (piCurrency !== expectedCurrency) {
        throw new Error(
          `stripe_currency_mismatch: expected ${expectedCurrency}, got ${piCurrency} (pi=${pi.id})`,
        );
      }

      if (pi.status === "succeeded") {
        return { chargeId: pi.id, status: "succeeded" };
      }

      return {
        chargeId: pi.id,
        status: "declined",
        declineReason: `stripe_status_${pi.status}`,
      };
    },

    async chargeRecurring(input: RecurringChargeInput): Promise<ChargeResult> {
      // Off-session MIT charge. Stripe distinguishes "soft" declines (card
      // problem — return declined) from "hard" failures (network/auth — throw
      // so the worker retries). The retriever is responsible for translating
      // SDK exceptions into either return values or rethrows.
      let pi: StripePaymentIntentSnapshot;
      try {
        pi = await stripe.createOffSession({
          customer: input.customerRef,
          payment_method: input.paymentMethodRef,
          amount: input.amount,
          currency: input.currency.toLowerCase(),
          idempotencyKey: input.idempotencyKey,
        });
      } catch (err) {
        // The wrapper is expected to convert StripeCardError into a structured
        // result (see `createStripeGatewayFromKey` below). Anything that
        // bubbles up here is treated as transient and rethrown for retry.
        throw err;
      }

      if (pi.status === "succeeded") {
        return { chargeId: pi.id, status: "succeeded" };
      }

      // `requires_action` (3DS challenge) is technically off-session-failed
      // for our purposes — we can't prompt the customer in a cron, so it's
      // a decline and the worker marks past_due.
      const declineReason =
        pi.lastErrorCode ??
        (pi.status === "requires_action" ? "authentication_required" : `stripe_status_${pi.status}`);

      return {
        chargeId: pi.id,
        status: "declined",
        declineReason,
      };
    },
  };
}

/**
 * Convenience factory wiring the real Stripe SDK.
 *
 * Used by `server.ts` in production. Tests should use `createStripeGateway`
 * directly with a fake retriever.
 */
export function createStripeGatewayFromKey(secretKey: string): PaymentGateway {
  const stripe = new Stripe(secretKey);
  return createStripeGateway({
    stripe: {
      retrieve: async (id) => {
        const pi = await stripe.paymentIntents.retrieve(id);
        return {
          id: pi.id,
          status: pi.status,
          amount: pi.amount,
          currency: pi.currency,
        };
      },
      createOffSession: async (args) => {
        try {
          const pi = await stripe.paymentIntents.create(
            {
              customer: args.customer,
              payment_method: args.payment_method,
              amount: args.amount,
              currency: args.currency,
              off_session: true,
              confirm: true,
              // NOTE: do NOT set `setup_future_usage` here — it's incompatible
              // with `off_session: true`. The PM is already attached to the
              // customer from the original CIT (`/finalize` set
              // setup_future_usage=off_session on the first PI), so subsequent
              // off-session charges can just reuse it.
            },
            { idempotencyKey: args.idempotencyKey },
          );
          return {
            id: pi.id,
            status: pi.status,
            amount: pi.amount,
            currency: pi.currency,
            client_secret: pi.client_secret,
            ...(pi.last_payment_error?.code
              ? { lastErrorCode: pi.last_payment_error.code }
              : {}),
            ...(pi.last_payment_error?.message
              ? { lastErrorMessage: pi.last_payment_error.message }
              : {}),
          };
        } catch (err) {
          // StripeCardError → soft decline. Surface a synthetic snapshot so
          // the gateway returns a `declined` result instead of throwing.
          if (err instanceof Stripe.errors.StripeCardError) {
            return {
              id: err.payment_intent?.id ?? "pi_unknown",
              status: err.payment_intent?.status ?? "requires_payment_method",
              amount: args.amount,
              currency: args.currency,
              ...(err.code ? { lastErrorCode: err.code } : {}),
              ...(err.message ? { lastErrorMessage: err.message } : {}),
            };
          }
          // Everything else (rate-limit, network, API down) → rethrow so the
          // worker can retry the run on its next cron tick.
          throw err;
        }
      },
    },
  });
}
