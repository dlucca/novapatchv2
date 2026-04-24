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

export interface PaymentGateway {
  charge(input: ChargeInput): Promise<ChargeResult>;
}

export type StubOutcome = "succeeded" | "declined" | "throw";

export interface CreateStubGatewayOpts {
  defaultOutcome?: StubOutcome;
  outcomeByToken?: Record<string, StubOutcome>;
  declineReason?: string;
}

/**
 * Deterministic in-memory gateway for tests. Semantics:
 *   - "succeeded" → returns {chargeId, status: "succeeded"}
 *   - "declined"  → returns {chargeId, status: "declined", declineReason}
 *   - "throw"     → throws Error("gateway timeout")
 *
 * `outcomeByToken` takes precedence over `defaultOutcome`.
 * The default default is "succeeded".
 */
export function createStubGateway(opts: CreateStubGatewayOpts): PaymentGateway {
  const defaultOutcome = opts.defaultOutcome ?? "succeeded";
  const declineReason = opts.declineReason ?? "test_declined";
  const byToken = opts.outcomeByToken ?? {};

  return {
    async charge(input) {
      const outcome = byToken[input.token] ?? defaultOutcome;
      if (outcome === "throw") {
        throw new Error("gateway timeout");
      }
      const chargeId = `stub_${crypto.randomUUID()}`;
      if (outcome === "declined") {
        return { chargeId, status: "declined", declineReason };
      }
      return { chargeId, status: "succeeded" };
    },
  };
}
