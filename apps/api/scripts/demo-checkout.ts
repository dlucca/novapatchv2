// One-shot demo: exercises POST /me/checkout against the dev DB with
// stubs for Clerk + gateway. NOT production code — a manual smoke test.
// Run with: cd apps/api && bun run scripts/demo-checkout.ts

import { createApp } from "../src/index";
import { createStubVerifier, createStubUserClient } from "../src/lib/clerk";
import { createStubGateway } from "../src/lib/payment-gateway";
import { createDb } from "../src/db";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://novapatch:novapatch@localhost:5433/novapatch";

const { db, client } = createDb(DATABASE_URL);

const verifier = createStubVerifier({
  tok_diego: { clerkUserId: "user_diego" },
});
const userClient = createStubUserClient({
  user_diego: { clerkUserId: "user_diego", email: "diego@novapatch.mx" },
});
const gateway = createStubGateway({
  defaultOutcome: "succeeded",
  outcomeByToken: { tok_bad: "declined", tok_boom: "throw" },
  declineReason: "insufficient_funds",
});

const app = createApp({ verifier, userClient, db, gateway });

const SHIPPING = {
  line1: "Av. Insurgentes Sur 1234",
  line2: "Depto 5B",
  city: "Ciudad de México",
  state: "CDMX",
  postalCode: "03020",
  country: "MX",
};

function ik() {
  return crypto.randomUUID();
}

async function call(
  label: string,
  body: unknown,
  opts: { idempotencyKey?: string; auth?: boolean } = { auth: true },
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.auth !== false) headers.Authorization = "Bearer tok_diego";
  if (opts.idempotencyKey !== undefined)
    headers["Idempotency-Key"] = opts.idempotencyKey;
  const res = await app.fetch(
    new Request("http://localhost/me/checkout", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
  const json = await res.json();
  console.log(`\n=== ${label} ===`);
  console.log(`HTTP ${res.status}`);
  console.log(JSON.stringify(json, null, 2));
  return { status: res.status, body: json as Record<string, unknown> };
}

try {
  // 1. Happy path — one-time.
  await call("1. one-time, 2x energy", {
    market: "mx",
    items: [{ slug: "energy", quantity: 2 }],
    shippingAddress: SHIPPING,
    paymentToken: "tok_ok",
  }, { idempotencyKey: ik() });

  // 2. Happy path — subscription.
  await call("2. subscription, sleep every 30d", {
    market: "mx",
    items: [{ slug: "sleep", quantity: 1, subscription: { interval: 30 } }],
    shippingAddress: SHIPPING,
    paymentToken: "tok_ok",
    recurringConsent: true,
  }, { idempotencyKey: ik() });

  // 3. Declined charge → 402, nothing persisted.
  await call("3. declined charge", {
    market: "mx",
    items: [{ slug: "energy", quantity: 1 }],
    shippingAddress: SHIPPING,
    paymentToken: "tok_bad",
  }, { idempotencyKey: ik() });

  // 4. Idempotent replay — same key twice.
  const replayKey = ik();
  await call("4a. first submit", {
    market: "mx",
    items: [{ slug: "glow", quantity: 1 }],
    shippingAddress: SHIPPING,
    paymentToken: "tok_ok",
  }, { idempotencyKey: replayKey });
  await call("4b. same Idempotency-Key → 200 replay, no double charge", {
    market: "mx",
    items: [{ slug: "glow", quantity: 1 }],
    shippingAddress: SHIPPING,
    paymentToken: "tok_ok",
  }, { idempotencyKey: replayKey });

  // 5. Missing Idempotency-Key → 400.
  await call("5. missing Idempotency-Key", {
    market: "mx",
    items: [{ slug: "energy", quantity: 1 }],
    shippingAddress: SHIPPING,
    paymentToken: "tok_ok",
  });

  // 6. Sub without recurringConsent → 400.
  await call("6. subscription without recurringConsent", {
    market: "mx",
    items: [{ slug: "sleep", quantity: 1, subscription: { interval: 30 } }],
    shippingAddress: SHIPPING,
    paymentToken: "tok_ok",
  }, { idempotencyKey: ik() });

  // 7. Gateway throws → 502.
  await call("7. gateway timeout", {
    market: "mx",
    items: [{ slug: "energy", quantity: 1 }],
    shippingAddress: SHIPPING,
    paymentToken: "tok_boom",
  }, { idempotencyKey: ik() });
} finally {
  await client.end();
}
