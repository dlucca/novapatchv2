import type { MiddlewareHandler } from "hono";
import type { TokenVerifier } from "../lib/clerk";
import { apiError } from "../lib/errors";

const BEARER = /^Bearer\s+(\S+)\s*$/;

/**
 * Factory returning a Hono middleware that:
 *   - reads `Authorization: Bearer <jwt>` from the request
 *   - delegates JWT verification to the provided TokenVerifier
 *   - on success attaches `clerkUserId` to the Hono context
 *   - on failure returns a 401 with the canonical error envelope
 *
 * The verifier is injected so tests can pass a stub and production can pass
 * a real Clerk-backed verifier.
 */
export function authMiddleware(verifier: TokenVerifier): MiddlewareHandler {
  return async (c, next) => {
    const header = c.req.header("Authorization");
    if (!header) {
      const { body, status } = apiError(
        "auth_missing",
        "Authorization header is required",
        401,
      );
      return c.json(body, status);
    }
    const match = header.match(BEARER);
    if (!match || !match[1]) {
      const { body, status } = apiError(
        "auth_malformed",
        "Authorization header must be 'Bearer <token>'",
        401,
      );
      return c.json(body, status);
    }
    const token = match[1];
    try {
      const { clerkUserId } = await verifier.verify(token);
      c.set("clerkUserId", clerkUserId);
      await next();
    } catch (err) {
      // Don't leak internals to the client, but log for ops — Clerk downtime
      // and a genuinely bad token look identical in the response, so the
      // server log is the only way to tell them apart.
      console.warn("[auth] verify failed:", err instanceof Error ? err.message : err);
      const { body, status } = apiError(
        "auth_invalid",
        "token could not be verified",
        401,
      );
      return c.json(body, status);
    }
  };
}
