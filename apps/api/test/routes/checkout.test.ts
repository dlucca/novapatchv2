import { describe, it, expect } from "bun:test";
import { eq } from "drizzle-orm";
import { createApp } from "../../src/index";
import { createStubVerifier, createStubUserClient } from "../../src/lib/clerk";
import { createStubGateway } from "../../src/lib/payment-gateway";
import { useTestDb } from "../helpers/db";
import { discountCodes } from "../../src/db/schema/discounts";
import { orders, orderItems } from "../../src/db/schema/orders";
import { subscriptions } from "../../src/db/schema/subscriptions";

const FIXED_NOW = new Date("2026-05-01T00:00:00Z");

const SHIPPING = {
  line1: "Av. X 1",
  city: "CDMX",
  state: "CDMX",
  postalCode: "00000",
  country: "MX",
};

function appBuilder(
  getDb: ReturnType<typeof useTestDb>["getDb"],
  overrides: {
    gatewayOutcome?: "succeeded" | "declined" | "throw";
    outcomeByToken?: Record<string, "succeeded" | "declined" | "throw">;
    declineReason?: string;
  } = {},
) {
  const verifier = createStubVerifier({ tok_alice: { clerkUserId: "user_alice" } });
  const userClient = createStubUserClient({
    user_alice: { clerkUserId: "user_alice", email: "alice@example.com" },
  });
  const gateway = createStubGateway({
    defaultOutcome: overrides.gatewayOutcome ?? "succeeded",
    ...(overrides.outcomeByToken ? { outcomeByToken: overrides.outcomeByToken } : {}),
    ...(overrides.declineReason ? { declineReason: overrides.declineReason } : {}),
  });
  return createApp({
    verifier,
    userClient,
    db: getDb(),
    gateway,
    getNow: () => FIXED_NOW,
  });
}

function postCheckout(app: ReturnType<typeof createApp>, body: unknown, opts: {
  auth?: string;
  idempotencyKey?: string;
} = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.auth !== undefined) headers.Authorization = opts.auth;
  if (opts.idempotencyKey !== undefined) headers["Idempotency-Key"] = opts.idempotencyKey;
  return app.fetch(
    new Request("http://localhost/me/checkout", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /me/checkout — happy paths", () => {
  const { getDb } = useTestDb();

  it("201 one-time only: persists order + items, no subscriptions", async () => {
    const app = appBuilder(getDb);
    const res = await postCheckout(
      app,
      {
        market: "mx",
        items: [{ slug: "energy", quantity: 2 }],
        shippingAddress: SHIPPING,
        paymentToken: "tok_ok",
      },
      { auth: "Bearer tok_alice", idempotencyKey: "ik-one-time" },
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      orderId: string;
      chargeId: string;
      subscriptions: unknown[];
    };
    expect(body.orderId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(body.chargeId).toMatch(/^stub_/);
    expect(body.subscriptions).toEqual([]);

    const db = getDb();
    const saved = await db.select().from(orders).where(eq(orders.id, body.orderId));
    expect(saved[0]?.idempotencyKey).toBe("ik-one-time");
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, body.orderId));
    expect(items).toHaveLength(1);
    expect(items[0]?.quantity).toBe(2);
  });

  it("201 subscription only: persists subscription with nextBillingDate = now + 30d", async () => {
    const app = appBuilder(getDb);
    const res = await postCheckout(
      app,
      {
        market: "mx",
        items: [{ slug: "sleep", quantity: 1, subscription: { interval: 30 } }],
        shippingAddress: SHIPPING,
        paymentToken: "tok_ok",
        recurringConsent: true,
      },
      { auth: "Bearer tok_alice", idempotencyKey: "ik-sub" },
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      subscriptions: Array<{ id: string; slug: string; interval: number; nextBillingDate: string }>;
    };
    expect(body.subscriptions).toHaveLength(1);
    expect(body.subscriptions[0]?.slug).toBe("sleep");
    expect(body.subscriptions[0]?.interval).toBe(30);
    expect(body.subscriptions[0]?.nextBillingDate).toBe("2026-05-31");

    const db = getDb();
    const savedSub = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, body.subscriptions[0]!.id));
    expect(savedSub[0]?.unitPrice).toBe(36000);
  });

  it("200 replay response has the same shape as the 201 (includes quote)", async () => {
    const app = appBuilder(getDb);
    const body = {
      market: "mx",
      items: [{ slug: "energy", quantity: 1 }],
      shippingAddress: SHIPPING,
      paymentToken: "tok_ok",
    };

    const first = await postCheckout(app, body, {
      auth: "Bearer tok_alice",
      idempotencyKey: "ik-shape",
    });
    expect(first.status).toBe(201);
    const firstBody = (await first.json()) as {
      orderId: string;
      chargeId: string;
      quote: { subtotal: number; total: number; currency: string };
      subscriptions: unknown[];
    };

    const second = await postCheckout(app, body, {
      auth: "Bearer tok_alice",
      idempotencyKey: "ik-shape",
    });
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as typeof firstBody;

    expect(secondBody.orderId).toBe(firstBody.orderId);
    expect(secondBody.chargeId).toBe(firstBody.chargeId);
    expect(secondBody.quote.subtotal).toBe(firstBody.quote.subtotal);
    expect(secondBody.quote.total).toBe(firstBody.quote.total);
    expect(secondBody.quote.currency).toBe(firstBody.quote.currency);
  });

  it("201 mixed cart + discount: persists order + items + sub + redemption, bumps times_used", async () => {
    const db = getDb();
    const [code] = await db
      .insert(discountCodes)
      .values({
        code: "welcome10",
        kind: "promo",
        discountPct: 10,
        markets: ["mx"],
        appliesTo: "all",
        status: "active",
      })
      .returning();

    const app = appBuilder(getDb);
    const res = await postCheckout(
      app,
      {
        market: "mx",
        items: [
          { slug: "energy", quantity: 1 },
          { slug: "sleep", quantity: 1, subscription: { interval: 30 } },
        ],
        shippingAddress: SHIPPING,
        paymentToken: "tok_ok",
        recurringConsent: true,
        discountCode: "WELCOME10",
      },
      { auth: "Bearer tok_alice", idempotencyKey: "ik-mix" },
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      orderId: string;
      quote: { discountAmount: number; subtotal: number };
    };
    expect(body.quote.discountAmount).toBe(Math.round((45000 + 36000) * 0.1));

    const refreshed = await db.select().from(discountCodes).where(eq(discountCodes.id, code!.id));
    expect(refreshed[0]?.timesUsed).toBe(1);
  });
});

describe("POST /me/checkout — validation", () => {
  const { getDb } = useTestDb();

  it("401 without Authorization", async () => {
    const app = appBuilder(getDb);
    const res = await postCheckout(
      app,
      { market: "mx", items: [{ slug: "energy", quantity: 1 }], shippingAddress: SHIPPING, paymentToken: "tok_ok" },
      { idempotencyKey: "ik-401" },
    );
    expect(res.status).toBe(401);
  });

  it("400 idempotency_key_missing when header is absent", async () => {
    const app = appBuilder(getDb);
    const res = await postCheckout(
      app,
      { market: "mx", items: [{ slug: "energy", quantity: 1 }], shippingAddress: SHIPPING, paymentToken: "tok_ok" },
      { auth: "Bearer tok_alice" },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("idempotency_key_missing");
  });

  it("400 validation_failed when body is malformed", async () => {
    const app = appBuilder(getDb);
    const res = await postCheckout(
      app,
      { market: "mx" },
      { auth: "Bearer tok_alice", idempotencyKey: "ik-bad" },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; details?: unknown } };
    expect(body.error.code).toBe("validation_failed");
    expect(body.error.details).toBeDefined();
  });

  it("400 when cart has a subscription but recurringConsent is missing", async () => {
    const app = appBuilder(getDb);
    const res = await postCheckout(
      app,
      {
        market: "mx",
        items: [{ slug: "sleep", quantity: 1, subscription: { interval: 30 } }],
        shippingAddress: SHIPPING,
        paymentToken: "tok_ok",
      },
      { auth: "Bearer tok_alice", idempotencyKey: "ik-no-consent" },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; details?: { reason?: string } } };
    expect(body.error.code).toBe("validation_failed");
    expect(body.error.details?.reason).toBe("recurring_consent_required");
  });
});

describe("POST /me/checkout — gateway + replay + burn prevention", () => {
  const { getDb } = useTestDb();

  it("402 payment_declined when gateway declines — writes NOTHING to DB", async () => {
    const db = getDb();
    const app = appBuilder(getDb, {
      outcomeByToken: { tok_decline: "declined" },
      declineReason: "card_declined",
    });
    const res = await postCheckout(
      app,
      {
        market: "mx",
        items: [{ slug: "energy", quantity: 1 }],
        shippingAddress: SHIPPING,
        paymentToken: "tok_decline",
      },
      { auth: "Bearer tok_alice", idempotencyKey: "ik-declined" },
    );
    expect(res.status).toBe(402);
    const body = (await res.json()) as { error: { code: string; details?: { declineReason: string } } };
    expect(body.error.code).toBe("payment_declined");
    expect(body.error.details?.declineReason).toBe("card_declined");

    expect(await db.select().from(orders)).toHaveLength(0);
    expect(await db.select().from(orderItems)).toHaveLength(0);
    expect(await db.select().from(subscriptions)).toHaveLength(0);
  });

  it("502 gateway_error when gateway throws — writes NOTHING to DB", async () => {
    const db = getDb();
    const app = appBuilder(getDb, { outcomeByToken: { tok_boom: "throw" } });
    const res = await postCheckout(
      app,
      {
        market: "mx",
        items: [{ slug: "energy", quantity: 1 }],
        shippingAddress: SHIPPING,
        paymentToken: "tok_boom",
      },
      { auth: "Bearer tok_alice", idempotencyKey: "ik-boom" },
    );
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("gateway_error");

    expect(await db.select().from(orders)).toHaveLength(0);
  });

  it("idempotent replay: second identical request returns 200 with same orderId, no double insert, no double charge", async () => {
    const db = getDb();
    let chargeCalls = 0;
    const gateway = {
      async charge(input: unknown) {
        chargeCalls += 1;
        return createStubGateway({ defaultOutcome: "succeeded" }).charge(
          input as Parameters<ReturnType<typeof createStubGateway>["charge"]>[0],
        );
      },
    };
    const verifier = createStubVerifier({ tok_alice: { clerkUserId: "user_alice" } });
    const userClient = createStubUserClient({
      user_alice: { clerkUserId: "user_alice", email: "alice@example.com" },
    });
    const app = createApp({
      verifier,
      userClient,
      db,
      gateway,
      getNow: () => FIXED_NOW,
    });

    const body = {
      market: "mx",
      items: [{ slug: "energy", quantity: 1 }],
      shippingAddress: SHIPPING,
      paymentToken: "tok_ok",
    };
    const first = await postCheckout(app, body, {
      auth: "Bearer tok_alice",
      idempotencyKey: "ik-replay",
    });
    expect(first.status).toBe(201);
    const firstBody = (await first.json()) as { orderId: string };

    const second = await postCheckout(app, body, {
      auth: "Bearer tok_alice",
      idempotencyKey: "ik-replay",
    });
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { orderId: string };

    expect(secondBody.orderId).toBe(firstBody.orderId);
    expect(chargeCalls).toBe(1);
    expect(await db.select().from(orders)).toHaveLength(1);
  });

  it("discount burn prevention: declined charge does NOT bump times_used, retry with good token bumps to 1", async () => {
    const db = getDb();
    const [code] = await db
      .insert(discountCodes)
      .values({
        code: "welcome10",
        kind: "promo",
        discountPct: 10,
        markets: ["mx"],
        appliesTo: "all",
        status: "active",
      })
      .returning();

    const app = appBuilder(getDb, {
      outcomeByToken: { tok_decline: "declined", tok_ok: "succeeded" },
    });

    const declined = await postCheckout(
      app,
      {
        market: "mx",
        items: [{ slug: "energy", quantity: 1 }],
        shippingAddress: SHIPPING,
        paymentToken: "tok_decline",
        discountCode: "welcome10",
      },
      { auth: "Bearer tok_alice", idempotencyKey: "ik-burn-1" },
    );
    expect(declined.status).toBe(402);

    const after1 = await db.select().from(discountCodes).where(eq(discountCodes.id, code!.id));
    expect(after1[0]?.timesUsed).toBe(0);

    const ok = await postCheckout(
      app,
      {
        market: "mx",
        items: [{ slug: "energy", quantity: 1 }],
        shippingAddress: SHIPPING,
        paymentToken: "tok_ok",
        discountCode: "welcome10",
      },
      { auth: "Bearer tok_alice", idempotencyKey: "ik-burn-2" },
    );
    expect(ok.status).toBe(201);

    const after2 = await db.select().from(discountCodes).where(eq(discountCodes.id, code!.id));
    expect(after2[0]?.timesUsed).toBe(1);
  });

  it("400 discount_below_minimum when code minSubtotal > cart subtotal", async () => {
    const db = getDb();
    await db
      .insert(discountCodes)
      .values({
        code: "bigspender",
        kind: "promo",
        discountPct: 20,
        markets: ["mx"],
        appliesTo: "all",
        status: "active",
        minSubtotal: 1_000_000,
      })
      .returning();

    const app = appBuilder(getDb);
    const res = await postCheckout(
      app,
      {
        market: "mx",
        items: [{ slug: "energy", quantity: 1 }],
        shippingAddress: SHIPPING,
        paymentToken: "tok_ok",
        discountCode: "bigspender",
      },
      { auth: "Bearer tok_alice", idempotencyKey: "ik-below-min" },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("discount_below_minimum");
  });
});
