import type { MiddlewareHandler } from "hono";
import { isMarketId, resolveMarket, type Market } from "@novapatch/markets";

declare module "hono" {
  interface ContextVariableMap {
    market: Market;
  }
}

export const marketMiddleware: MiddlewareHandler = async (c, next) => {
  const raw = c.req.query("market");
  if (!raw) {
    return c.json({ error: "missing ?market query parameter" }, 400);
  }
  const normalized = raw.toLowerCase();
  if (!isMarketId(normalized)) {
    return c.json({ error: `unknown market: ${raw}` }, 400);
  }
  c.set("market", resolveMarket(normalized));
  await next();
};
