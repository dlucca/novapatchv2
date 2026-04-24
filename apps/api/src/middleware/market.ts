import type { MiddlewareHandler } from "hono";
import { isMarketId, resolveMarket } from "@novapatch/markets";

export const marketMiddleware: MiddlewareHandler = async (c, next) => {
  const raw = c.req.query("market");
  if (raw === undefined) {
    return c.json({ error: "missing ?market query parameter" }, 400);
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "") {
    return c.json({ error: "empty ?market query parameter" }, 400);
  }
  if (!isMarketId(normalized)) {
    return c.json({ error: `unknown market: ${raw}` }, 400);
  }
  c.set("market", resolveMarket(normalized));
  await next();
};
