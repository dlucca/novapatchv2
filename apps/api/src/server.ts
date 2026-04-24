import { createApp } from "./index";
import { readEnv } from "./env";
import { createClerkVerifier, createClerkUserClient } from "./lib/clerk";
import { createDb } from "./db";
import { createStubGateway } from "./lib/payment-gateway";

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

const app = createApp({
  verifier,
  userClient,
  db,
  // TODO: swap for real Openpay/MercadoPago/Stripe adapter in a follow-up plan.
  gateway: createStubGateway({ defaultOutcome: "succeeded" }),
});

const server = Bun.serve({
  port: env.PORT,
  fetch: (req) => app.fetch(req),
});

console.log(`api listening on http://localhost:${server.port}`);
