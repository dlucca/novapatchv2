import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { healthRoutes } from "./routes/health";
import { catalogRoutes } from "./routes/catalog";
import { createMeRoutes } from "./routes/me";
import { createDiscountRoutes } from "./routes/discounts";
import { apiError } from "./lib/errors";
import { readEnv } from "./env";
import type { TokenVerifier, ClerkUserClient } from "./lib/clerk";
import type { Db } from "./db";

export interface AppDeps {
  verifier?: TokenVerifier;
  userClient?: ClerkUserClient;
  db?: Db;
}

// Root application factory.
// Always mounts: logger, cors, error handlers, /health, /catalog.
// Conditionally mounts /me/* when all auth+db deps are provided.
//
// Convention: the mount prefix lives HERE; route modules use bare paths
// internally. e.g. `app.route("/catalog", catalogRoutes)`
// + `catalogRoutes.get("/", ...)` -> `/catalog`. One routing table of contents
// in this file.

/**
 * Attaches the canonical error envelope to `notFound` and `onError` on the given app.
 * Exported so tests can wire it onto a fresh Hono instance without reimporting `app`.
 */
export function registerErrorHandlers(target: Hono): void {
  target.notFound((c) => {
    const { body, status } = apiError("not_found", `route not found: ${c.req.path}`, 404);
    return c.json(body, status);
  });

  target.onError((err, c) => {
    console.error("[api:onError]", err);
    const { body, status } = apiError(
      "internal_error",
      "an internal error occurred",
      500,
    );
    return c.json(body, status);
  });
}

export function createApp(deps: AppDeps = {}): Hono {
  const env = readEnv();
  const app = new Hono();

  app.use("*", logger());

  app.use(
    "*",
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Authorization", "Content-Type"],
      maxAge: 600,
    }),
  );

  registerErrorHandlers(app);

  app.route("/", healthRoutes);
  app.route("/catalog", catalogRoutes);

  if (deps.db) {
    app.route("/discounts", createDiscountRoutes(deps.db));
  }

  if (deps.verifier && deps.userClient && deps.db) {
    app.route("/me", createMeRoutes(deps.verifier, deps.userClient, deps.db));
  }

  return app;
}

// Backward-compatible singleton for existing tests that do
// `import { app } from "../src/index"`. No deps -> /me is omitted.
export const app = createApp();
