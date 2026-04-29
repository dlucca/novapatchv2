import { createApp } from "./index";
import { readEnv } from "./env";
import { createClerkVerifier, createClerkUserClient } from "./lib/clerk";
import { createDb } from "./db";
import { createStubGateway, type PaymentGateway } from "./lib/payment-gateway";
import { createStripeGatewayFromKey } from "./lib/stripe-gateway";

const env = readEnv();

if (!env.CLERK_SECRET_KEY) {
  throw new Error(
    "CLERK_SECRET_KEY is required to start the API server. Set it in .env (see .env.example).",
  );
}
if (!env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required to start the API server. Set it in .env (see .env.example).",
  );
}

const verifier = createClerkVerifier({ secretKey: env.CLERK_SECRET_KEY });
const userClient = createClerkUserClient({ secretKey: env.CLERK_SECRET_KEY });
const { db } = createDb(env.DATABASE_URL);

// Choose payment gateway: Stripe when STRIPE_SECRET_KEY is set, otherwise
// fall back to the in-memory stub (development convenience only). In
// production STRIPE_SECRET_KEY is expected to be present.
const gateway: PaymentGateway = env.STRIPE_SECRET_KEY
  ? createStripeGatewayFromKey(env.STRIPE_SECRET_KEY)
  : createStubGateway({ defaultOutcome: "succeeded" });

if (!env.STRIPE_SECRET_KEY) {
  console.warn(
    "[api] STRIPE_SECRET_KEY not set — using stub payment gateway (dev only).",
  );
}

if (!env.WEBHOOK_SHARED_SECRET) {
  console.warn(
    "[api] WEBHOOK_SHARED_SECRET not set — /webhook/checkout disabled (guest checkout via Stripe webhook will not persist orders).",
  );
}

const app = createApp({
  verifier,
  userClient,
  db,
  gateway,
  ...(env.WEBHOOK_SHARED_SECRET ? { webhookSharedSecret: env.WEBHOOK_SHARED_SECRET } : {}),
});

const server = Bun.serve({
  port: env.PORT,
  fetch: (req) => app.fetch(req),
});

console.log(`api listening on http://localhost:${server.port}`);
