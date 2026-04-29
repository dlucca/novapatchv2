import { describe, it, expect } from "bun:test";
import { createApp } from "../../src/index";
import { createStubGateway } from "../../src/lib/payment-gateway";
import { useTestDb } from "../helpers/db";
import { customers } from "../../src/db/schema/customers";
import { orders } from "../../src/db/schema/orders";
import { subscriptions } from "../../src/db/schema/subscriptions";

const FIXED_NOW = new Date("2026-05-15T08:00:00.000Z");
const SECRET = "admin-cron-secret-with-32-chars-padding-XX";

function buildApp(getDb: ReturnType<typeof useTestDb>["getDb"]) {
  const gateway = createStubGateway({ defaultRecurringOutcome: "succeeded" });
  return createApp({
    db: getDb(),
    gateway,
    webhookSharedSecret: SECRET,
    getNow: () => FIXED_NOW,
  });
}

async function seedDueSub(getDb: ReturnType<typeof useTestDb>["getDb"]) {
  const db = getDb();
  const [c] = await db
    .insert(customers)
    .values({
      clerkUserId: `u_${Math.random().toString(36).slice(2)}`,
      email: `${Math.random().toString(36).slice(2)}@x.com`,
      gatewayCustomerIds: { stub: "cus_xxx" } as unknown as { stripe?: string },
      defaultCardId: "pm_xxx",
    })
    .returning();
  const [o] = await db
    .insert(orders)
    .values({
      customerId: c!.id,
      market: "mx",
      currency: "MXN",
      subtotal: 36000,
      tax: 0,
      shipping: 8500,
      total: 50260,
      discountAmount: 0,
      status: "paid",
      paymentProvider: "stub",
      shippingAddress: {},
    })
    .returning();
  await db.insert(subscriptions).values({
    customerId: c!.id,
    originalOrderId: o!.id,
    productSlug: "sleep",
    intervalDays: 30,
    unitPrice: 36000,
    quantity: 1,
    market: "mx",
    currency: "MXN",
    status: "active",
    nextBillingDate: "2026-05-15",
    shippingAddress: {
      line1: "Av X",
      city: "CDMX",
      state: "CDMX",
      postalCode: "01000",
      country: "MX",
    },
  });
}

describe("POST /admin/subscriptions/run-cron", () => {
  const { getDb } = useTestDb();

  it("returns 401 service_auth_invalid without X-Service-Auth", async () => {
    const app = buildApp(getDb);
    const res = await app.fetch(
      new Request("http://localhost/admin/subscriptions/run-cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 with a wrong secret", async () => {
    const app = buildApp(getDb);
    const res = await app.fetch(
      new Request("http://localhost/admin/subscriptions/run-cron", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Auth": "this-is-wrong-but-still-32-chars-XXXXXXXX",
        },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 + report when authenticated, processing due subs", async () => {
    await seedDueSub(getDb);
    const app = buildApp(getDb);
    const res = await app.fetch(
      new Request("http://localhost/admin/subscriptions/run-cron", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Auth": SECRET,
        },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      materialize: { runsCreated: number };
      processed: number;
      succeeded: number;
    };
    expect(body.materialize.runsCreated).toBe(1);
    expect(body.processed).toBe(1);
    expect(body.succeeded).toBe(1);
  });

  it("respects maxRuns from body", async () => {
    await seedDueSub(getDb);
    await seedDueSub(getDb);
    await seedDueSub(getDb);
    const app = buildApp(getDb);
    const res = await app.fetch(
      new Request("http://localhost/admin/subscriptions/run-cron", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Auth": SECRET,
        },
        body: JSON.stringify({ maxRuns: 2 }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { materialize: { runsCreated: number }; processed: number };
    expect(body.materialize.runsCreated).toBe(3);
    expect(body.processed).toBe(2);
  });
});
