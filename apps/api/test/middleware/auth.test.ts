import { describe, it, expect } from "bun:test";
import { Hono } from "hono";
import { authMiddleware } from "../../src/middleware/auth";
import { createStubVerifier } from "../../src/lib/clerk";

type ErrorBody = { error: { code: string; message: string } };

function buildApp() {
  const verifier = createStubVerifier({
    "tok_alice": { clerkUserId: "user_alice" },
  });
  const app = new Hono();
  app.use("*", authMiddleware(verifier));
  app.get("/probe", (c) => c.json({ clerkUserId: c.get("clerkUserId") }));
  return app;
}

describe("authMiddleware", () => {
  it("attaches clerkUserId from a valid bearer token", async () => {
    const res = await buildApp().fetch(
      new Request("http://localhost/probe", {
        headers: { Authorization: "Bearer tok_alice" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { clerkUserId: string };
    expect(body.clerkUserId).toBe("user_alice");
  });

  it("returns 401 + auth_missing when the Authorization header is absent", async () => {
    const res = await buildApp().fetch(new Request("http://localhost/probe"));
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("auth_missing");
  });

  it("returns 401 + auth_malformed when the scheme is not Bearer", async () => {
    const res = await buildApp().fetch(
      new Request("http://localhost/probe", {
        headers: { Authorization: "Basic abc" },
      }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("auth_malformed");
  });

  it("returns 401 + auth_malformed when Bearer has no token", async () => {
    const res = await buildApp().fetch(
      new Request("http://localhost/probe", {
        headers: { Authorization: "Bearer " },
      }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("auth_malformed");
  });

  it("returns 401 + auth_invalid when verify throws", async () => {
    const res = await buildApp().fetch(
      new Request("http://localhost/probe", {
        headers: { Authorization: "Bearer tok_unknown" },
      }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("auth_invalid");
  });
});
