import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import type { TokenVerifier, ClerkUserClient } from "../lib/clerk";
import type { Db } from "../db";
import { upsertCustomerByClerkUserId } from "../repos/customers";
import type { Customer } from "../db/schema/customers";

function serializeCustomer(c: Customer) {
  return {
    id: c.id,
    clerkUserId: c.clerkUserId,
    email: c.email,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

/**
 * Factory for the `/me/*` route module. Takes explicit deps so tests can
 * inject stubs and production wires the real Clerk-backed clients.
 *
 * Protected: every route inside is guarded by `authMiddleware(verifier)`.
 */
export function createMeRoutes(
  verifier: TokenVerifier,
  userClient: ClerkUserClient,
  db: Db,
): Hono {
  const me = new Hono();

  me.use("*", authMiddleware(verifier));

  me.get("/customer", async (c) => {
    const clerkUserId = c.get("clerkUserId");
    const { email } = await userClient.getUser(clerkUserId);
    const customer = await upsertCustomerByClerkUserId(db, {
      clerkUserId,
      email,
    });
    return c.json(serializeCustomer(customer));
  });

  return me;
}
