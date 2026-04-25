import { describe, it, expect } from "bun:test";
import { createApp } from "../../src/index";
import { useTestDb } from "../helpers/db";
import { discountCodes } from "../../src/db/schema/discounts";

type ValidBody = {
  valid: true;
  code: string;
  discountPct: number;
  appliesTo: "all" | "once" | "subscription";
  discountAmount: number;
  eligibleSubtotal: number;
  quote: {
    subtotal: number;
    discountAmount: number;
    tax: number;
    shipping: number;
    total: number;
  };
};
type InvalidBody = { valid: false; reason: string };
type ErrorBody = { error: { code: string; message: string; details?: unknown } };

describe("POST /discounts/validate", () => {
  const { getDb } = useTestDb();

  function buildApp() {
    return createApp({ db: getDb() });
  }

  async function seedActive(code: string, overrides: Partial<typeof discountCodes.$inferInsert> = {}) {
    const [row] = await getDb()
      .insert(discountCodes)
      .values({
        code,
        kind: "promo",
        discountPct: 10,
        markets: ["mx"],
        appliesTo: "all",
        status: "active",
        ...overrides,
      })
      .returning();
    return row!;
  }

  it("returns 400 validation_failed on missing fields", async () => {
    const res = await buildApp().fetch(
      new Request("http://localhost/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("validation_failed");
    expect(body.error.details).toBeDefined();
  });

  it("returns 400 market_unknown on a non-existent market", async () => {
    const res = await buildApp().fetch(
      new Request("http://localhost/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "anything",
          market: "zz",
          items: [{ slug: "energy", quantity: 1 }],
        }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("market_unknown");
  });

  it("returns {valid:false, reason:discount_not_found} with 200 for unknown code", async () => {
    const res = await buildApp().fetch(
      new Request("http://localhost/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "nope",
          market: "mx",
          items: [{ slug: "energy", quantity: 1 }],
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as InvalidBody;
    expect(body.valid).toBe(false);
    expect(body.reason).toBe("discount_not_found");
  });

  it("returns {valid:true, ...} with the computed quote on success (case-insensitive code match)", async () => {
    await seedActive("welcome10", { discountPct: 10, appliesTo: "all", markets: ["mx"] });
    const res = await buildApp().fetch(
      new Request("http://localhost/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "WELCOME10",
          market: "mx",
          items: [{ slug: "energy", quantity: 1 }],
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as ValidBody;
    expect(body.valid).toBe(true);
    expect(body.code).toBe("welcome10");
    expect(body.discountPct).toBe(10);
    expect(body.appliesTo).toBe("all");
    expect(body.eligibleSubtotal).toBe(75000);
    expect(body.discountAmount).toBe(7500);
    expect(body.quote.subtotal).toBe(75000);
    expect(body.quote.discountAmount).toBe(7500);
    expect(body.quote.total).toBe(75000 - 7500 + Math.round((75000 - 7500) * 0.16) + 8500);
  });

  it("returns {valid:false, reason:discount_below_minimum} when cart is too small", async () => {
    await seedActive("minspend", { minSubtotal: 90000 });
    const res = await buildApp().fetch(
      new Request("http://localhost/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "minspend",
          market: "mx",
          items: [{ slug: "energy", quantity: 1 }],
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as InvalidBody;
    expect(body.valid).toBe(false);
    expect(body.reason).toBe("discount_below_minimum");
  });

  it("respects market scoping — a code valid only in BR is not found in MX", async () => {
    await seedActive("bronly", { markets: ["br"] });
    const res = await buildApp().fetch(
      new Request("http://localhost/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "bronly",
          market: "mx",
          items: [{ slug: "energy", quantity: 1 }],
        }),
      }),
    );
    const body = (await res.json()) as InvalidBody;
    expect(body.valid).toBe(false);
    expect(body.reason).toBe("discount_not_found");
  });
});
