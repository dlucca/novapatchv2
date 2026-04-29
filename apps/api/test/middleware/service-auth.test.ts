import { describe, it, expect } from "bun:test";
import { Hono } from "hono";
import { serviceAuthMiddleware } from "../../src/middleware/service-auth";

const SECRET = "0123456789abcdef0123456789abcdef0123456789"; // 42 chars
type ErrorBody = { error: { code: string; message: string } };

function buildApp(secret: string = SECRET) {
  const app = new Hono();
  app.use("*", serviceAuthMiddleware(secret));
  app.post("/probe", (c) => c.json({ ok: true }));
  return app;
}

describe("serviceAuthMiddleware", () => {
  it("passes through when X-Service-Auth matches the configured secret", async () => {
    const res = await buildApp().fetch(
      new Request("http://localhost/probe", {
        method: "POST",
        headers: { "X-Service-Auth": SECRET },
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("returns 401 + service_auth_invalid when the header is absent", async () => {
    const res = await buildApp().fetch(
      new Request("http://localhost/probe", { method: "POST" }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("service_auth_invalid");
  });

  it("returns 401 + service_auth_invalid when the header is wrong", async () => {
    const res = await buildApp().fetch(
      new Request("http://localhost/probe", {
        method: "POST",
        headers: { "X-Service-Auth": "wrong-but-same-length-padding-ABCDEFGHIJ" },
      }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("service_auth_invalid");
  });

  it("returns 401 when only a prefix matches (timing-safe rejects partial match)", async () => {
    const res = await buildApp().fetch(
      new Request("http://localhost/probe", {
        method: "POST",
        headers: { "X-Service-Auth": SECRET.slice(0, 10) },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("does NOT use Authorization header (collision avoidance with Clerk auth)", async () => {
    const res = await buildApp().fetch(
      new Request("http://localhost/probe", {
        method: "POST",
        headers: { Authorization: `Bearer ${SECRET}` },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("throws at construction time when the secret is shorter than 32 chars", () => {
    expect(() => serviceAuthMiddleware("too-short")).toThrow(/≥32/);
  });
});
