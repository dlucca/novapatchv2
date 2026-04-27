import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import type { TokenVerifier, ClerkUserClient } from "../lib/clerk";
import type { Db } from "../db";
import type { PaymentGateway } from "../lib/payment-gateway";
import { upsertCustomerByClerkUserId } from "../repos/customers";
import type { Customer } from "../db/schema/customers";
import { createCheckoutRoutes } from "./checkout";
import { createSubscriptionRoutes } from "./subscriptions";
import { createOrdersRoutes } from "./orders";

function serializeCustomer(c: Customer) {
  return {
    id: c.id,
    clerkUserId: c.clerkUserId,
    email: c.email,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export interface MeDeps {
  verifier: TokenVerifier;
  userClient: ClerkUserClient;
  db: Db;
  gateway?: PaymentGateway;
  getNow?: () => Date;
}

/**
 * Factory for the `/me/*` route module. Auth middleware runs for every
 * nested route. `/checkout` is mounted only when `gateway` is provided;
 * `/customer` is always mounted.
 */
export function createMeRoutes(deps: MeDeps): Hono {
  const me = new Hono();

  me.use("*", authMiddleware(deps.verifier));

  me.get("/customer", async (c) => {
    const clerkUserId = c.get("clerkUserId");
    const { email } = await deps.userClient.getUser(clerkUserId);
    const customer = await upsertCustomerByClerkUserId(deps.db, {
      clerkUserId,
      email,
      market: "mx",
    });
    return c.json(serializeCustomer(customer));
  });

  me.route(
    "/subscriptions",
    createSubscriptionRoutes({
      db: deps.db,
      userClient: deps.userClient,
      getNow: deps.getNow ?? (() => new Date()),
    }),
  );

  me.route(
    "/orders",
    createOrdersRoutes({ db: deps.db, userClient: deps.userClient }),
  );

  if (deps.gateway) {
    me.route(
      "/checkout",
      createCheckoutRoutes({
        db: deps.db,
        userClient: deps.userClient,
        gateway: deps.gateway,
        getNow: deps.getNow ?? (() => new Date()),
      }),
    );
  }

  return me;
}
