import { describe, it, expect } from "bun:test";
import { createStubGateway } from "../../src/lib/payment-gateway";

describe("createStubGateway", () => {
  it("returns succeeded by default when no opts given", async () => {
    const gw = createStubGateway({});
    const res = await gw.charge({ token: "tok_any", amount: 1000, currency: "MXN" });
    expect(res.status).toBe("succeeded");
    expect(res.chargeId).toMatch(/^stub_[0-9a-f-]+$/i);
  });

  it("returns declined when defaultOutcome is declined, with declineReason", async () => {
    const gw = createStubGateway({ defaultOutcome: "declined", declineReason: "card_declined" });
    const res = await gw.charge({ token: "tok_x", amount: 1000, currency: "MXN" });
    expect(res.status).toBe("declined");
    if (res.status !== "declined") throw new Error("expected declined");
    expect(res.declineReason).toBe("card_declined");
    expect(res.chargeId).toMatch(/^stub_/);
  });

  it("throws when defaultOutcome is throw", async () => {
    const gw = createStubGateway({ defaultOutcome: "throw" });
    await expect(gw.charge({ token: "tok_x", amount: 1000, currency: "MXN" })).rejects.toThrow(
      /gateway timeout/,
    );
  });

  it("outcomeByToken overrides defaultOutcome per token", async () => {
    const gw = createStubGateway({
      defaultOutcome: "succeeded",
      outcomeByToken: { tok_bad: "declined", tok_boom: "throw" },
      declineReason: "insufficient_funds",
    });
    expect((await gw.charge({ token: "tok_ok", amount: 1, currency: "MXN" })).status).toBe(
      "succeeded",
    );
    const declined = await gw.charge({ token: "tok_bad", amount: 1, currency: "MXN" });
    expect(declined.status).toBe("declined");
    if (declined.status !== "declined") throw new Error("expected declined");
    expect(declined.declineReason).toBe("insufficient_funds");
    await expect(gw.charge({ token: "tok_boom", amount: 1, currency: "MXN" })).rejects.toThrow();
  });

  it("produces a unique chargeId per call", async () => {
    const gw = createStubGateway({});
    const a = await gw.charge({ token: "t", amount: 1, currency: "MXN" });
    const b = await gw.charge({ token: "t", amount: 1, currency: "MXN" });
    expect(a.chargeId).not.toBe(b.chargeId);
  });
});
