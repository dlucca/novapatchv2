import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { healthRoutes } from "./routes/health";
import { catalogRoutes } from "./routes/catalog";
import { apiError } from "./lib/errors";
import { readEnv } from "./env";

// Root application. Route modules live in ./routes/*.ts and are mounted below.
// Convention: the mount prefix lives HERE; route modules use bare paths internally.
// e.g. `app.route("/catalog", catalogRoutes)` + `catalogRoutes.get("/", ...)` → `/catalog`.
// This gives us a single routing table of contents in this file.

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

const env = readEnv();

export const app = new Hono();

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
