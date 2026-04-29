import type { MiddlewareHandler } from "hono";
import { apiError } from "../lib/errors";

/**
 * Factory returning a Hono middleware that validates a shared-secret header
 * for trusted server-to-server callers (e.g. the Stripe webhook in apps/web
 * calling apps/api to persist a guest checkout).
 *
 * Security:
 *   - Compares with timing-safe equality to defeat timing-oracle attacks.
 *   - Requires the configured secret to be ≥32 chars (env-validated upstream).
 *   - Returns the canonical 401 envelope on mismatch — never reveals which
 *     side was wrong (missing vs malformed vs incorrect).
 *
 * The header name is `X-Service-Auth`. We deliberately do NOT use
 * `Authorization` so this path can never collide with the Clerk Bearer flow
 * on the same Hono app.
 */
export function serviceAuthMiddleware(expected: string): MiddlewareHandler {
  if (expected.length < 32) {
    throw new Error("serviceAuthMiddleware: shared secret must be ≥32 chars");
  }
  const expectedBytes = new TextEncoder().encode(expected);

  return async (c, next) => {
    const header = c.req.header("X-Service-Auth");
    if (!header) {
      const { body, status } = apiError(
        "service_auth_invalid",
        "service authentication failed",
        401,
      );
      return c.json(body, status);
    }
    const candidateBytes = new TextEncoder().encode(header);
    if (!timingSafeEqual(candidateBytes, expectedBytes)) {
      const { body, status } = apiError(
        "service_auth_invalid",
        "service authentication failed",
        401,
      );
      return c.json(body, status);
    }
    await next();
  };
}

/**
 * Constant-time byte comparison. Length mismatch returns false but still
 * walks the longer buffer to avoid leaking length via timing. (Length itself
 * is observable through the header — that's fine; the secret length is
 * fixed in our config so observing length doesn't help an attacker.)
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}
