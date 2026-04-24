import { describe, it, expect } from "bun:test";
import { Hono } from "hono";
import { marketMiddleware } from "../../src/middleware/market";

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
    const body = (await res.json()) as any;
    expect(body.market.id).toBe("mx");
    expect(body.market.currency).toBe("MXN");
  });

  it("is case-insensitive", async () => {
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/probe?market=MX"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.market.id).toBe("mx");
  });

  it("returns 400 when ?market is missing", async () => {
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/probe"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toMatch(/market/i);
  });

  it("returns 400 when ?market is unknown", async () => {
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/probe?market=us"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toMatch(/market/i);
  });
});
