import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import type { Db } from "../db";
import type { ClerkUserClient } from "../lib/clerk";
import { apiError } from "../lib/errors";
import { upsertCustomerByClerkUserId } from "../repos/customers";
import {
  listByCustomerId,
  getByIdForCustomer,
  updateStatus,
} from "../repos/subscriptions";
import {
  applySubscriptionAction,
  type SubscriptionAction,
} from "../services/subscription-actions";
import type { Subscription } from "../db/schema/subscriptions";

const FrequencyBodySchema = z.object({
  intervalDays: z.union([z.literal(30), z.literal(60), z.literal(90)]),
});

export interface SubscriptionRoutesDeps {
  db: Db;
  userClient: ClerkUserClient;
  getNow: () => Date;
}

function serialize(s: Subscription) {
  return {
    id: s.id,
    productSlug: s.productSlug,
    intervalDays: s.intervalDays,
    unitPrice: s.unitPrice,
    quantity: s.quantity,
    market: s.market,
    currency: s.currency,
    status: s.status,
    nextBillingDate: s.nextBillingDate,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    canceledAt: s.canceledAt ? s.canceledAt.toISOString() : null,
  };
}

async function resolveCustomer(
  deps: SubscriptionRoutesDeps,
  clerkUserId: string,
): Promise<{ id: string }> {
  const { email } = await deps.userClient.getUser(clerkUserId);
  return await upsertCustomerByClerkUserId(deps.db, { clerkUserId, email });
}

export function createSubscriptionRoutes(deps: SubscriptionRoutesDeps): Hono {
  const r = new Hono();

  r.get("/", async (c) => {
    const clerkUserId = c.get("clerkUserId");
    const customer = await resolveCustomer(deps, clerkUserId);
    const rows = await listByCustomerId(deps.db, customer.id);
    return c.json({ subscriptions: rows.map(serialize) });
  });

  async function runMutation(
    c: Context,
    action: SubscriptionAction,
    intervalDays?: 30 | 60 | 90,
  ) {
    const clerkUserId = c.get("clerkUserId");
    const customer = await resolveCustomer(deps, clerkUserId);
    const id = c.req.param("id");
    if (!id) {
      const { body, status } = apiError("not_found", "subscription not found", 404);
      return c.json(body, status);
    }
    const existing = await getByIdForCustomer(deps.db, { id, customerId: customer.id });
    if (!existing) {
      const { body, status } = apiError("not_found", "subscription not found", 404);
      return c.json(body, status);
    }

    const result = applySubscriptionAction({
      sub: existing,
      action,
      getNow: deps.getNow,
      ...(intervalDays !== undefined ? { intervalDays } : {}),
    });

    if (!result.ok) {
      const { body, status } = apiError(
        "subscription_invalid_state",
        `action '${result.action}' not allowed from status '${result.currentStatus}'`,
        409,
        { currentStatus: result.currentStatus, action: result.action },
      );
      return c.json(body, status);
    }

    const updated = await updateStatus(deps.db, {
      id,
      ...result.update,
    });
    return c.json(serialize(updated));
  }

  r.post("/:id/pause", (c) => runMutation(c, "pause"));
  r.post("/:id/resume", (c) => runMutation(c, "resume"));
  r.post("/:id/cancel", (c) => runMutation(c, "cancel"));

  r.post("/:id/frequency", async (c) => {
    const parsed = FrequencyBodySchema.safeParse(
      await c.req.json().catch(() => ({})),
    );
    if (!parsed.success) {
      const { body, status } = apiError(
        "validation_failed",
        "invalid request body",
        400,
        parsed.error.flatten(),
      );
      return c.json(body, status);
    }
    return runMutation(c, "frequency", parsed.data.intervalDays);
  });

  return r;
}
