import { Hono } from "hono";
import type { Db } from "../db";
import type { PaymentGateway } from "../lib/payment-gateway";
import { serviceAuthMiddleware } from "../middleware/service-auth";
import { runSubscriptionCron } from "../services/run-subscription-cron";

export interface AdminSubscriptionCronDeps {
  db: Db;
  gateway: PaymentGateway;
  serviceSecret: string;
  getNow: () => Date;
}

/**
 * `POST /admin/subscriptions/run-cron` — trigger endpoint for the
 * subscription renewal cron. Authenticated with `X-Service-Auth: <shared
 * secret>` (same mechanism as `/webhook/checkout`). Designed to be hit by
 * an external scheduler (Vercel Cron, GitHub Actions schedule, Railway
 * Cron, etc.) on a daily cadence.
 *
 * Optional body: `{ maxRuns?: number }` — caps the number of runs processed
 * per invocation. Defaults to 100. Useful for split-batch scheduling.
 *
 * Always returns 200 with a structured report unless the secret is wrong
 * (401) or the gateway dependency is missing at app construction time (the
 * route is simply not mounted in that case).
 */
export function createAdminSubscriptionCronRoutes(
  deps: AdminSubscriptionCronDeps,
): Hono {
  const r = new Hono();

  r.use("*", serviceAuthMiddleware(deps.serviceSecret));

  r.post("/run-cron", async (c) => {
    let maxRuns: number | undefined;
    try {
      const body = (await c.req.json().catch(() => ({}))) as { maxRuns?: number };
      if (typeof body.maxRuns === "number" && body.maxRuns > 0 && body.maxRuns <= 1000) {
        maxRuns = body.maxRuns;
      }
    } catch {
      // No body or invalid JSON — fine, use defaults.
    }

    const report = await runSubscriptionCron({
      db: deps.db,
      gateway: deps.gateway,
      now: deps.getNow(),
      ...(maxRuns !== undefined ? { maxRuns } : {}),
    });
    return c.json(report, 200);
  });

  return r;
}
