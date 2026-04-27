import { describe, it, expect } from "bun:test";
import { eq } from "drizzle-orm";
import { createApp } from "../../src/index";
import { createStubVerifier, createStubUserClient } from "../../src/lib/clerk";
import { useTestDb } from "../helpers/db";
import { persistOrder } from "../../src/repos/orders";
import { subscriptions } from "../../src/db/schema/subscriptions";

const FIXED_NOW = new Date("2026-05-01T00:00:00Z");
const SHIPPING = {
  line1: "Av. X 1",
  city: "CDMX",
  state: "CDMX",
  postalCode: "00000",
  country: "MX",
};

function buildApp(getDb: ReturnType<typeof useTestDb>["getDb"]) {
  const verifier = createStubVerifier({
    tok_alice: { clerkUserId: "user_alice" },
    tok_bob: { clerkUserId: "user_bob" },
  });
  const userClient = createStubUserClient({
    user_alice: { clerkUserId: "user_alice", email: "alice@example.com" },
    user_bob: { clerkUserId: "user_bob", email: "bob@example.com" },
  });
  return createApp({
    verifier,
    userClient,
    db: getDb(),
    getNow: () => FIXED_NOW,
  });
}

async function seedSubViaPersist(
  db: ReturnType<typeof useTestDb>["getDb"] extends () => infer T ? T : never,
  customerId: string,
  opts: {
    intervalDays?: 30 | 60 | 90;
    status?: "active" | "paused" | "canceled" | "past_due" | "delayed_oos";
    nextBillingDate?: string;
    productSlug?: "energy" | "sleep" | "glow" | "shield" | "zen" | "woman";
  } = {},
) {
  const intervalDays = opts.intervalDays ?? 30;
  const productSlug = opts.productSlug ?? "sleep";
  const res = await persistOrder(db, {
    order: {
      customerId,
      market: "mx",
      currency: "MXN",
      subtotal: 36000,
      tax: 5760,
      shipping: 8500,
      discountAmount: 0,
      total: 50260,
      status: "paid",
      paymentProvider: "stub",
      paymentChargeId: "stub_seed",
      shippingAddress: SHIPPING,
      idempotencyKey: `seed_${crypto.randomUUID()}`,
    },
    orderItems: [
      {
        productSlug,
        name: productSlug,
        unitPrice: 36000,
        quantity: 1,
        isSubscription: true,
        intervalDays,
        discountPct: 20,
      },
    ],
    subscriptions: [
      {
        customerId,
        productSlug,
        intervalDays,
        unitPrice: 36000,
        quantity: 1,
        market: "mx",
        currency: "MXN",
        status: opts.status ?? "active",
        nextBillingDate: opts.nextBillingDate ?? "2026-05-24",
        shippingAddress: SHIPPING,
      },
    ],
    paymentAttempt: {
      provider: "stub",
      providerChargeId: `stub_${crypto.randomUUID()}`,
      amount: 50260,
      currency: "MXN",
      status: "succeeded",
    },
  });
  return res.subscriptionIds[0]!;
}

async function ensureCustomer(
  app: ReturnType<typeof createApp>,
  bearer: string,
): Promise<string> {
  const res = await app.fetch(
    new Request("http://localhost/me/customer", {
      headers: { Authorization: bearer },
    }),
  );
  const body = (await res.json()) as { id: string };
  return body.id;
}

function request(
  app: ReturnType<typeof createApp>,
  path: string,
  opts: { method?: string; auth?: string; body?: unknown } = {},
) {
  const headers: Record<string, string> = {};
  if (opts.auth !== undefined) headers.Authorization = opts.auth;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  return app.fetch(
    new Request(`http://localhost${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    }),
  );
}

describe("GET /me/subscriptions", () => {
  const { getDb } = useTestDb();

  it("401 without Authorization", async () => {
    const app = buildApp(getDb);
    const res = await request(app, "/me/subscriptions");
    expect(res.status).toBe(401);
  });

  it("returns only the caller's subs, sorted by createdAt DESC", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const bobId = await ensureCustomer(app, "Bearer tok_bob");

    const firstAlice = await seedSubViaPersist(db, aliceId, { productSlug: "energy" });
    await Bun.sleep(10);
    const secondAlice = await seedSubViaPersist(db, aliceId, { productSlug: "sleep" });
    await seedSubViaPersist(db, bobId, { productSlug: "glow" });

    const res = await request(app, "/me/subscriptions", { auth: "Bearer tok_alice" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { subscriptions: Array<{ id: string }> };
    expect(body.subscriptions).toHaveLength(2);
    expect(body.subscriptions[0]?.id).toBe(secondAlice);
    expect(body.subscriptions[1]?.id).toBe(firstAlice);
  });
});

describe("POST /me/subscriptions/:id/pause", () => {
  const { getDb } = useTestDb();

  it("200 on active → status paused", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const subId = await seedSubViaPersist(db, aliceId, { status: "active" });

    const res = await request(app, `/me/subscriptions/${subId}/pause`, {
      method: "POST",
      auth: "Bearer tok_alice",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("paused");
  });

  it("409 subscription_invalid_state on paused", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const subId = await seedSubViaPersist(db, aliceId, { status: "paused" });

    const res = await request(app, `/me/subscriptions/${subId}/pause`, {
      method: "POST",
      auth: "Bearer tok_alice",
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string; details?: { currentStatus: string; action: string } } };
    expect(body.error.code).toBe("subscription_invalid_state");
    expect(body.error.details?.currentStatus).toBe("paused");
    expect(body.error.details?.action).toBe("pause");
  });

  it("404 when sub belongs to another customer", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const bobId = await ensureCustomer(app, "Bearer tok_bob");
    const bobSub = await seedSubViaPersist(db, bobId, { status: "active" });

    const res = await request(app, `/me/subscriptions/${bobSub}/pause`, {
      method: "POST",
      auth: "Bearer tok_alice",
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("not_found");

    const stillActive = await db.select().from(subscriptions).where(eq(subscriptions.id, bobSub));
    expect(stillActive[0]?.status).toBe("active");
  });

  it("404 when sub doesn't exist", async () => {
    const app = buildApp(getDb);
    await ensureCustomer(app, "Bearer tok_alice");
    const res = await request(
      app,
      "/me/subscriptions/00000000-0000-0000-0000-000000000000/pause",
      { method: "POST", auth: "Bearer tok_alice" },
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /me/subscriptions/:id/resume", () => {
  const { getDb } = useTestDb();

  it("200 on paused → status active, nextBillingDate = today + intervalDays", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const subId = await seedSubViaPersist(db, aliceId, {
      status: "paused",
      intervalDays: 30,
      nextBillingDate: "2026-04-01",
    });

    const res = await request(app, `/me/subscriptions/${subId}/resume`, {
      method: "POST",
      auth: "Bearer tok_alice",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; nextBillingDate: string };
    expect(body.status).toBe("active");
    expect(body.nextBillingDate).toBe("2026-05-31");
  });

  it("409 when already active", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const subId = await seedSubViaPersist(db, aliceId, { status: "active" });
    const res = await request(app, `/me/subscriptions/${subId}/resume`, {
      method: "POST",
      auth: "Bearer tok_alice",
    });
    expect(res.status).toBe(409);
  });
});

describe("POST /me/subscriptions/:id/cancel", () => {
  const { getDb } = useTestDb();

  it("200 on active → canceled with canceledAt set", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const subId = await seedSubViaPersist(db, aliceId, { status: "active" });

    const res = await request(app, `/me/subscriptions/${subId}/cancel`, {
      method: "POST",
      auth: "Bearer tok_alice",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; canceledAt: string | null };
    expect(body.status).toBe("canceled");
    expect(body.canceledAt).toBe(FIXED_NOW.toISOString());
  });

  it("200 on paused → canceled", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const subId = await seedSubViaPersist(db, aliceId, { status: "paused" });
    const res = await request(app, `/me/subscriptions/${subId}/cancel`, {
      method: "POST",
      auth: "Bearer tok_alice",
    });
    expect(res.status).toBe(200);
  });

  it("200 on past_due → canceled", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const subId = await seedSubViaPersist(db, aliceId, { status: "past_due" });
    const res = await request(app, `/me/subscriptions/${subId}/cancel`, {
      method: "POST",
      auth: "Bearer tok_alice",
    });
    expect(res.status).toBe(200);
  });

  it("409 on already canceled", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const subId = await seedSubViaPersist(db, aliceId, { status: "canceled" });
    const res = await request(app, `/me/subscriptions/${subId}/cancel`, {
      method: "POST",
      auth: "Bearer tok_alice",
    });
    expect(res.status).toBe(409);
  });
});

describe("POST /me/subscriptions/:id/frequency", () => {
  const { getDb } = useTestDb();

  it("200 on active 30 → 90: intervalDays + nextBillingDate updated", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const subId = await seedSubViaPersist(db, aliceId, { status: "active", intervalDays: 30 });

    const res = await request(app, `/me/subscriptions/${subId}/frequency`, {
      method: "POST",
      auth: "Bearer tok_alice",
      body: { intervalDays: 90 },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      intervalDays: number;
      nextBillingDate: string;
    };
    expect(body.status).toBe("active");
    expect(body.intervalDays).toBe(90);
    expect(body.nextBillingDate).toBe("2026-07-30");
  });

  it("200 on paused 30 → 60: stays paused", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const subId = await seedSubViaPersist(db, aliceId, { status: "paused", intervalDays: 30 });
    const res = await request(app, `/me/subscriptions/${subId}/frequency`, {
      method: "POST",
      auth: "Bearer tok_alice",
      body: { intervalDays: 60 },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; intervalDays: number };
    expect(body.status).toBe("paused");
    expect(body.intervalDays).toBe(60);
  });

  it("400 validation_failed on invalid intervalDays", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const subId = await seedSubViaPersist(db, aliceId, { status: "active" });
    const res = await request(app, `/me/subscriptions/${subId}/frequency`, {
      method: "POST",
      auth: "Bearer tok_alice",
      body: { intervalDays: 45 },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("validation_failed");
  });

  it("409 on canceled", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const subId = await seedSubViaPersist(db, aliceId, { status: "canceled" });
    const res = await request(app, `/me/subscriptions/${subId}/frequency`, {
      method: "POST",
      auth: "Bearer tok_alice",
      body: { intervalDays: 60 },
    });
    expect(res.status).toBe(409);
  });
});
