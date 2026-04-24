import type { MiddlewareHandler } from "hono";
import { isMarketId, resolveMarket } from "@novapatch/markets";
import { apiError } from "../lib/errors";

export const marketMiddleware: MiddlewareHandler = async (c, next) => {
  const raw = c.req.query("market");
  if (raw === undefined) {
    const { body, status } = apiError(
      "market_missing",
      "missing ?market query parameter",
      400,
    );
    return c.json(body, status);
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "") {
    const { body, status } = apiError(
      "market_empty",
      "empty ?market query parameter",
      400,
    );
    return c.json(body, status);
  }
  if (!isMarketId(normalized)) {
    const { body, status } = apiError(
      "market_unknown",
      `unknown market: ${raw}`,
      400,
    );
    return c.json(body, status);
  }
  c.set("market", resolveMarket(normalized));
  await next();
};
