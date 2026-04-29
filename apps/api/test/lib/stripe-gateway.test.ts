import { describe, it, expect } from "bun:test";
import {
  createStripeGateway,
  type StripePaymentIntentClient,
  type StripePaymentIntentSnapshot,
} from "../../src/lib/stripe-gateway";

function fakeClient(byId: Record<string, StripePaymentIntentSnapshot>): StripePaymentIntentClient {
  return {
    async retrieve(id: string) {
      const pi = byId[id];
      if (!pi) throw new Error(`stripe_pi_not_found: ${id}`);
      return pi;
    },
    async createOffSession() {
      throw new Error("createOffSession not used in these tests");
    },
  };
}

const fakeRetriever = fakeClient;

describe("createStripeGateway", () => {
  it("returns succeeded with the PI id when status==succeeded and amount/currency match", async () => {
    const gw = createStripeGateway({
      stripe: fakeRetriever({
        pi_ok: { id: "pi_ok", status: "succeeded", amount: 84500, currency: "mxn" },
      }),
    });
    const res = await gw.charge({ token: "pi_ok", amount: 84500, currency: "MXN" });
    expect(res.status).toBe("succeeded");
    expect(res.chargeId).toBe("pi_ok");
  });

  it("compares currency case-insensitively", async () => {
    const gw = createStripeGateway({
      stripe: fakeRetriever({
        pi_x: { id: "pi_x", status: "succeeded", amount: 100, currency: "MXN" },
      }),
    });
    const res = await gw.charge({ token: "pi_x", amount: 100, currency: "mxn" });
    expect(res.status).toBe("succeeded");
  });

  it("declines with stripe_status_<status> for non-succeeded statuses (matched amount)", async () => {
    const gw = createStripeGateway({
      stripe: fakeRetriever({
        pi_pend: { id: "pi_pend", status: "requires_payment_method", amount: 100, currency: "mxn" },
      }),
    });
    const res = await gw.charge({ token: "pi_pend", amount: 100, currency: "mxn" });
    expect(res.status).toBe("declined");
    if (res.status !== "declined") throw new Error("expected declined");
    expect(res.declineReason).toBe("stripe_status_requires_payment_method");
    expect(res.chargeId).toBe("pi_pend");
  });

  it("throws on amount mismatch (tampering / bug — not a silent decline)", async () => {
    const gw = createStripeGateway({
      stripe: fakeRetriever({
        pi_t: { id: "pi_t", status: "succeeded", amount: 100, currency: "mxn" },
      }),
    });
    await expect(
      gw.charge({ token: "pi_t", amount: 99999, currency: "mxn" }),
    ).rejects.toThrow(/stripe_amount_mismatch/);
  });

  it("throws on currency mismatch", async () => {
    const gw = createStripeGateway({
      stripe: fakeRetriever({
        pi_t: { id: "pi_t", status: "succeeded", amount: 100, currency: "usd" },
      }),
    });
    await expect(
      gw.charge({ token: "pi_t", amount: 100, currency: "mxn" }),
    ).rejects.toThrow(/stripe_currency_mismatch/);
  });

  it("propagates retriever errors (e.g. PI not found) — route maps to gateway_error", async () => {
    const gw = createStripeGateway({ stripe: fakeRetriever({}) });
    await expect(
      gw.charge({ token: "pi_missing", amount: 100, currency: "mxn" }),
    ).rejects.toThrow(/stripe_pi_not_found/);
  });

  it("exposes name === 'stripe' for order/payment_attempt provider stamping", () => {
    const gw = createStripeGateway({ stripe: fakeRetriever({}) });
    expect(gw.name).toBe("stripe");
  });
});
