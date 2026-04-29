import { describe, it, expect } from "bun:test";
import { eq } from "drizzle-orm";
import { createApp } from "../../src/index";
import { createStubGateway } from "../../src/lib/payment-gateway";
import { useTestDb } from "../helpers/db";
import { orders } from "../../src/db/schema/orders";
import { customers } from "../../src/db/schema/customers";
import { paymentAttempts } from "../../src/db/schema/payment-attempts";

const FIXED_NOW = new Date("2026-05-01T00:00:00Z");
const SHARED_SECRET = "test-secret-with-at-least-32-chars-padding";

const SHIPPING = {
  line1: "Av. Reforma 222",
  city: "CDMX",
  state: "CDMX",
  postalCode: "06600",
  country: "MX",
};

function buildApp(
  getDb: ReturnType<typeof useTestDb>["getDb"],
  outcome: "succeeded" | "declined" | "throw" = "succeeded",
) {
  const gateway = createStubGateway({ defaultOutcome: outcome });
  return createApp({
    db: getDb(),
    gateway,
    webhookSharedSecret: SHARED_SECRET,
    getNow: () => FIXED_NOW,
  });
}

function postWebhook(
  app: ReturnType<typeof createApp>,
  body: unknown,
  opts: { auth?: string; idempotencyKey?: string } = {},
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.auth !== undefined) headers["X-Service-Auth"] = opts.auth;
  if (opts.idempotencyKey !== undefined)
    headers["Idempotency-Key"] = opts.idempotencyKey;
  return app.fetch(
    new Request("http://localhost/webhook/checkout", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /webhook/checkout — auth + happy paths", () => {
  const { getDb } = useTestDb();

  it("returns 401 service_auth_invalid without X-Service-Auth", async () => {
    const app = buildApp(getDb);
    const res = await postWebhook(
      app,
      {
        customerEmail: "guest@example.com",
        market: "mx",
        items: [{ slug: "energy", quantity: 1 }],
        shippingAddress: SHIPPING,
        paymentToken: "pi_xyz",
      },
      { idempotencyKey: "pi_xyz" },
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("service_auth_invalid");
  });

  it("returns 401 with a wrong secret", async () => {
    const app = buildApp(getDb);
    const res = await postWebhook(
      app,
      {
        customerEmail: "guest@example.com",
        market: "mx",
        items: [{ slug: "energy", quantity: 1 }],
        shippingAddress: SHIPPING,
        paymentToken: "pi_xyz",
      },
      { auth: "wrong-secret-but-with-32-chars-padding-XX", idempotencyKey: "pi_xyz" },
    );
    expect(res.status).toBe(401);
  });

  it("201 one-time guest checkout: creates guest customer + persists order", async () => {
    const app = buildApp(getDb);
    const res = await postWebhook(
      app,
      {
        customerEmail: "guest@example.com",
        market: "mx",
        items: [{ slug: "energy", quantity: 2 }],
        shippingAddress: SHIPPING,
        paymentToken: "pi_3ABC",
      },
      { auth: SHARED_SECRET, idempotencyKey: "pi_3ABC" },
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      orderId: string;
      chargeId: string;
      subscriptions: unknown[];
    };
    expect(body.orderId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(body.subscriptions).toEqual([]);

    const db = getDb();
    const [savedCustomer] = await db
      .select()
      .from(customers)
      .where(eq(customers.email, "guest@example.com"));
    expect(savedCustomer?.clerkUserId).toMatch(/^guest_[0-9a-f]{32}$/);

    const [savedOrder] = await db.select().from(orders).where(eq(orders.id, body.orderId));
    expect(savedOrder?.customerId).toBe(savedCustomer!.id);
    expect(savedOrder?.idempotencyKey).toBe("pi_3ABC");
    expect(savedOrder?.paymentProvider).toBe("stub");

    const [attempt] = await db
      .select()
      .from(paymentAttempts)
      .where(eq(paymentAttempts.orderId, body.orderId));
    expect(attempt?.provider).toBe("stub");
    expect(attempt?.status).toBe("succeeded");
  });

  it("201 subscription line: requires recurringConsent=true + gateway credentials, persists them on customer", async () => {
    const app = buildApp(getDb);
    const res = await postWebhook(
      app,
      {
        customerEmail: "guest@example.com",
        market: "mx",
        items: [{ slug: "sleep", quantity: 1, subscription: { interval: 30 } }],
        shippingAddress: SHIPPING,
        paymentToken: "pi_sub",
        recurringConsent: true,
        gatewayCustomer: "cus_test_xxx",
        paymentMethod: "pm_test_xxx",
      },
      { auth: SHARED_SECRET, idempotencyKey: "pi_sub" },
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { subscriptions: unknown[] };
    expect(body.subscriptions).toHaveLength(1);

    const db = getDb();
    const [savedCustomer] = await db
      .select()
      .from(customers)
      .where(eq(customers.email, "guest@example.com"));
    expect(savedCustomer?.defaultCardId).toBe("pm_test_xxx");
    expect(savedCustomer?.gatewayCustomerIds).toMatchObject({ stub: "cus_test_xxx" });
    expect(savedCustomer?.recurringConsentAt).toBeInstanceOf(Date);
  });

  it("400 when subscription line is missing gateway credentials", async () => {
    const app = buildApp(getDb);
    const res = await postWebhook(
      app,
      {
        customerEmail: "guest@example.com",
        market: "mx",
        items: [{ slug: "sleep", quantity: 1, subscription: { interval: 30 } }],
        shippingAddress: SHIPPING,
        paymentToken: "pi_sub_no_creds",
        recurringConsent: true,
        // gatewayCustomer + paymentMethod absent
      },
      { auth: SHARED_SECRET, idempotencyKey: "pi_sub_no_creds" },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { details?: { reason: string } } };
    expect(body.error.details?.reason).toBe("gateway_credentials_required_for_subscription");
  });

  it("400 validation_failed when subscription line lacks recurringConsent", async () => {
    const app = buildApp(getDb);
    const res = await postWebhook(
      app,
      {
        customerEmail: "guest@example.com",
        market: "mx",
        items: [{ slug: "sleep", quantity: 1, subscription: { interval: 30 } }],
        shippingAddress: SHIPPING,
        paymentToken: "pi_no_consent",
      },
      { auth: SHARED_SECRET, idempotencyKey: "pi_no_consent" },
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /webhook/checkout — idempotency + errors", () => {
  const { getDb } = useTestDb();

  it("idempotent replay: same Idempotency-Key returns 200 with same orderId, no duplicate insert", async () => {
    const app = buildApp(getDb);
    const body = {
      customerEmail: "guest@example.com",
      market: "mx",
      items: [{ slug: "energy", quantity: 1 }],
      shippingAddress: SHIPPING,
      paymentToken: "pi_replay",
    };
    const first = await postWebhook(app, body, {
      auth: SHARED_SECRET,
      idempotencyKey: "pi_replay",
    });
    expect(first.status).toBe(201);
    const firstBody = (await first.json()) as { orderId: string };

    const second = await postWebhook(app, body, {
      auth: SHARED_SECRET,
      idempotencyKey: "pi_replay",
    });
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { orderId: string; replayed: boolean };
    expect(secondBody.orderId).toBe(firstBody.orderId);
    expect(secondBody.replayed).toBe(true);

    const db = getDb();
    expect(await db.select().from(orders)).toHaveLength(1);
  });

  it("400 idempotency_key_missing without Idempotency-Key header", async () => {
    const app = buildApp(getDb);
    const res = await postWebhook(
      app,
      {
        customerEmail: "guest@example.com",
        market: "mx",
        items: [{ slug: "energy", quantity: 1 }],
        shippingAddress: SHIPPING,
        paymentToken: "pi_x",
      },
      { auth: SHARED_SECRET },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("idempotency_key_missing");
  });

  it("502 gateway_error when gateway throws", async () => {
    const app = buildApp(getDb, "throw");
    const res = await postWebhook(
      app,
      {
        customerEmail: "guest@example.com",
        market: "mx",
        items: [{ slug: "energy", quantity: 1 }],
        shippingAddress: SHIPPING,
        paymentToken: "pi_boom",
      },
      { auth: SHARED_SECRET, idempotencyKey: "pi_boom" },
    );
    expect(res.status).toBe(502);

    const db = getDb();
    expect(await db.select().from(orders)).toHaveLength(0);
  });

  it("402 payment_declined when gateway declines (no order created)", async () => {
    const app = buildApp(getDb, "declined");
    const res = await postWebhook(
      app,
      {
        customerEmail: "guest@example.com",
        market: "mx",
        items: [{ slug: "energy", quantity: 1 }],
        shippingAddress: SHIPPING,
        paymentToken: "pi_decl",
      },
      { auth: SHARED_SECRET, idempotencyKey: "pi_decl" },
    );
    expect(res.status).toBe(402);

    const db = getDb();
    expect(await db.select().from(orders)).toHaveLength(0);
  });
});

describe("POST /webhook/checkout — guest customer reuse", () => {
  const { getDb } = useTestDb();

  it("two checkouts with same email → same customer row", async () => {
    const app = buildApp(getDb);
    await postWebhook(
      app,
      {
        customerEmail: "Repeat@Example.com",
        market: "mx",
        items: [{ slug: "energy", quantity: 1 }],
        shippingAddress: SHIPPING,
        paymentToken: "pi_a",
      },
      { auth: SHARED_SECRET, idempotencyKey: "pi_a" },
    );
    await postWebhook(
      app,
      {
        customerEmail: "repeat@example.com", // different casing
        market: "mx",
        items: [{ slug: "sleep", quantity: 1 }],
        shippingAddress: SHIPPING,
        paymentToken: "pi_b",
      },
      { auth: SHARED_SECRET, idempotencyKey: "pi_b" },
    );
    const db = getDb();
    const rows = await db.select().from(customers);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe("repeat@example.com");
  });
});
