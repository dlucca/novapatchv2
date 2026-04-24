import { describe, it, expect } from "bun:test";
import { Hono } from "hono";
import { registerErrorHandlers } from "../src/index";

type ErrorBody = { error: { code: string; message: string } };

describe("app.notFound", () => {
  it("returns the error envelope with code=not_found and 404", async () => {
    const app = new Hono();
    registerErrorHandlers(app);
    const res = await app.fetch(new Request("http://localhost/does-not-exist"));
    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("not_found");
    expect(body.error.message).toMatch(/not found/i);
  });
});

describe("app.onError", () => {
  it("returns the error envelope with code=internal_error and 500 when a handler throws", async () => {
    const app = new Hono();
    registerErrorHandlers(app);
    app.get("/boom", () => {
      throw new Error("kaboom");
    });
    const res = await app.fetch(new Request("http://localhost/boom"));
    expect(res.status).toBe(500);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).toMatch(/internal/i);
  });

  it("does not leak the thrown error's message to the client", async () => {
    const app = new Hono();
    registerErrorHandlers(app);
    app.get("/boom", () => {
      throw new Error("sensitive internal detail");
    });
    const res = await app.fetch(new Request("http://localhost/boom"));
    const body = (await res.json()) as ErrorBody;
    expect(body.error.message).not.toMatch(/sensitive/i);
  });
});
