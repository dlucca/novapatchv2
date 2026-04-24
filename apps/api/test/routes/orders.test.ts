import { describe, it, expect } from "bun:test";
import { createApp } from "../../src/index";
import { createStubVerifier, createStubUserClient } from "../../src/lib/clerk";
import { useTestDb } from "../helpers/db";
import { persistOrder } from "../../src/repos/orders";

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
  return createApp({ verifier, userClient, db: getDb() });
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

async function seedOrder(
  db: ReturnType<typeof useTestDb>["getDb"] extends () => infer T ? T : never,
  customerId: string,
  productSlug: "energy" | "sleep",
  extraOrderFields: Record<string, unknown> = {},
) {
  const res = await persistOrder(db, {
    order: {
      customerId,
      market: "mx",
      currency: "MXN",
      subtotal: 45000,
      tax: 7200,
      shipping: 8500,
      discountAmount: 0,
      total: 60700,
      status: "paid",
      paymentProvider: "stub",
      paymentChargeId: `stub_${crypto.randomUUID()}`,
      shippingAddress: SHIPPING,
      idempotencyKey: `seed_${crypto.randomUUID()}`,
      ...extraOrderFields,
    },
    orderItems: [
      {
        productSlug,
        name: productSlug,
        unitPrice: 45000,
        quantity: 1,
        isSubscription: false,
      },
    ],
    subscriptions: [],
  });
  return res.orderId;
}

describe("GET /me/orders", () => {
  const { getDb } = useTestDb();

  it("401 without Authorization", async () => {
    const app = buildApp(getDb);
    const res = await app.fetch(new Request("http://localhost/me/orders"));
    expect(res.status).toBe(401);
  });

  it("returns empty array when the customer has no orders", async () => {
    const app = buildApp(getDb);
    await ensureCustomer(app, "Bearer tok_alice");
    const res = await app.fetch(
      new Request("http://localhost/me/orders", {
        headers: { Authorization: "Bearer tok_alice" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { orders: unknown[] };
    expect(body.orders).toEqual([]);
  });

  it("returns orders sorted by createdAt DESC with items embedded", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const first = await seedOrder(db, aliceId, "energy");
    await Bun.sleep(10);
    const second = await seedOrder(db, aliceId, "sleep");

    const res = await app.fetch(
      new Request("http://localhost/me/orders", {
        headers: { Authorization: "Bearer tok_alice" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      orders: Array<{
        id: string;
        total: number;
        items: Array<{ productSlug: string; quantity: number }>;
      }>;
    };
    expect(body.orders).toHaveLength(2);
    expect(body.orders[0]?.id).toBe(second);
    expect(body.orders[1]?.id).toBe(first);
    expect(body.orders[0]?.items).toHaveLength(1);
    expect(body.orders[0]?.items[0]?.productSlug).toBe("sleep");
  });

  it("returns only the caller's orders (cross-customer isolation)", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const bobId = await ensureCustomer(app, "Bearer tok_bob");
    await seedOrder(db, aliceId, "energy");
    await seedOrder(db, bobId, "sleep");

    const res = await app.fetch(
      new Request("http://localhost/me/orders", {
        headers: { Authorization: "Bearer tok_alice" },
      }),
    );
    const body = (await res.json()) as {
      orders: Array<{ items: Array<{ productSlug: string }> }>;
    };
    expect(body.orders).toHaveLength(1);
    expect(body.orders[0]?.items[0]?.productSlug).toBe("energy");
  });
});
