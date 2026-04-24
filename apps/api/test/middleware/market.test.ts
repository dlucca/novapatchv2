import { describe, it, expect } from "bun:test";
import { Hono } from "hono";
import { marketMiddleware } from "../../src/middleware/market";

type MarketBody = { market: { id: string; currency: string } };
type ErrorBody = { error: { code: string; message: string } };

function buildApp() {
  const app = new Hono();
  app.use("*", marketMiddleware);
  app.get("/probe", (c) => c.json({ market: c.get("market") }));
  return app;
}

describe("marketMiddleware", () => {
  it("attaches market from ?market= query", async () => {
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/probe?market=mx"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as MarketBody;
    expect(body.market.id).toBe("mx");
    expect(body.market.currency).toBe("MXN");
  });

  it("is case-insensitive", async () => {
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/probe?market=MX"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as MarketBody;
    expect(body.market.id).toBe("mx");
  });

  it("trims surrounding whitespace", async () => {
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/probe?market=%20mx%20"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as MarketBody;
    expect(body.market.id).toBe("mx");
  });

  it("returns 400 + code=market_missing when ?market is missing", async () => {
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/probe"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("market_missing");
    expect(body.error.message).toMatch(/missing/i);
  });

  it("returns 400 + code=market_empty when ?market is empty", async () => {
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/probe?market="));
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("market_empty");
    expect(body.error.message).toMatch(/empty/i);
  });

  it("returns 400 + code=market_unknown when ?market is not a known id", async () => {
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/probe?market=us"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("market_unknown");
    expect(body.error.message).toMatch(/unknown market/i);
  });
});
