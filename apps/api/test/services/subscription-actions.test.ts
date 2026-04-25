import { describe, it, expect } from "bun:test";
import type { Subscription } from "../../src/db/schema/subscriptions";
import { applySubscriptionAction } from "../../src/services/subscription-actions";

const FIXED_NOW = new Date("2026-05-01T00:00:00Z");
const getNow = () => FIXED_NOW;

function sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    customerId: "22222222-2222-2222-2222-222222222222",
    originalOrderId: "33333333-3333-3333-3333-333333333333",
    productSlug: "sleep",
    intervalDays: 30,
    unitPrice: 63750,
    quantity: 1,
    market: "mx",
    currency: "MXN",
    status: "active",
    nextBillingDate: "2026-05-24",
    shippingAddress: {},
    createdAt: new Date("2026-04-24T00:00:00Z"),
    updatedAt: new Date("2026-04-24T00:00:00Z"),
    canceledAt: null,
    ...overrides,
  };
}

describe("applySubscriptionAction — pause", () => {
  it("active → paused (no date change)", () => {
    const r = applySubscriptionAction({ sub: sub({ status: "active" }), action: "pause", getNow });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.update).toEqual({ status: "paused" });
    }
  });

  it.each([
    ["paused"],
    ["canceled"],
    ["past_due"],
    ["delayed_oos"],
  ] as const)("rejects pause from %s", (status) => {
    const r = applySubscriptionAction({ sub: sub({ status }), action: "pause", getNow });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("subscription_invalid_state");
      expect(r.currentStatus).toBe(status);
      expect(r.action).toBe("pause");
    }
  });
});

describe("applySubscriptionAction — resume", () => {
  it("paused → active with nextBillingDate = today + intervalDays", () => {
    const r = applySubscriptionAction({
      sub: sub({ status: "paused", intervalDays: 30 }),
      action: "resume",
      getNow,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.update).toEqual({ status: "active", nextBillingDate: "2026-05-31" });
    }
  });

  it("respects intervalDays=90", () => {
    const r = applySubscriptionAction({
      sub: sub({ status: "paused", intervalDays: 90 }),
      action: "resume",
      getNow,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.update.nextBillingDate).toBe("2026-07-30");
  });

  it.each([
    ["active"],
    ["canceled"],
    ["past_due"],
    ["delayed_oos"],
  ] as const)("rejects resume from %s", (status) => {
    const r = applySubscriptionAction({ sub: sub({ status }), action: "resume", getNow });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.currentStatus).toBe(status);
  });
});

describe("applySubscriptionAction — cancel", () => {
  it.each([
    ["active"],
    ["paused"],
    ["past_due"],
    ["delayed_oos"],
  ] as const)("%s → canceled with canceledAt=getNow()", (status) => {
    const r = applySubscriptionAction({ sub: sub({ status }), action: "cancel", getNow });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.update.status).toBe("canceled");
      expect(r.update.canceledAt).toEqual(FIXED_NOW);
    }
  });

  it("rejects cancel on already canceled", () => {
    const r = applySubscriptionAction({ sub: sub({ status: "canceled" }), action: "cancel", getNow });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.currentStatus).toBe("canceled");
  });
});

describe("applySubscriptionAction — frequency", () => {
  it("active 30 → 90 updates intervalDays + nextBillingDate", () => {
    const r = applySubscriptionAction({
      sub: sub({ status: "active", intervalDays: 30 }),
      action: "frequency",
      intervalDays: 90,
      getNow,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.update).toEqual({
        intervalDays: 90,
        nextBillingDate: "2026-07-30",
      });
    }
  });

  it("paused 30 → 60 updates both, status stays paused (no status field in update)", () => {
    const r = applySubscriptionAction({
      sub: sub({ status: "paused", intervalDays: 30 }),
      action: "frequency",
      intervalDays: 60,
      getNow,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.update).toEqual({
        intervalDays: 60,
        nextBillingDate: "2026-06-30",
      });
      expect("status" in r.update).toBe(false);
    }
  });

  it.each([
    ["canceled"],
    ["past_due"],
    ["delayed_oos"],
  ] as const)("rejects frequency from %s", (status) => {
    const r = applySubscriptionAction({
      sub: sub({ status }),
      action: "frequency",
      intervalDays: 60,
      getNow,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.currentStatus).toBe(status);
  });

  it("throws when action is frequency but intervalDays is missing", () => {
    expect(() =>
      applySubscriptionAction({
        sub: sub({ status: "active" }),
        action: "frequency",
        getNow,
      }),
    ).toThrow(/intervalDays is required/);
  });
});
