import { describe, it, expect } from "bun:test";
import { createApp } from "../../src/index";
import { createStubVerifier, createStubUserClient } from "../../src/lib/clerk";
import { useTestDb } from "../helpers/db";

type CustomerBody = {
  id: string;
  clerkUserId: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};
type ErrorBody = { error: { code: string; message: string } };

describe("GET /me/customer", () => {
  const { getDb } = useTestDb();

  function buildApp(opts: { userEmail?: string } = {}) {
    const verifier = createStubVerifier({
      "tok_alice": { clerkUserId: "user_alice" },
    });
    const userClient = createStubUserClient({
      "user_alice": {
        clerkUserId: "user_alice",
        email: opts.userEmail ?? "alice@example.com",
      },
    });
    return createApp({ verifier, userClient, db: getDb() });
  }

  it("returns 401 without Authorization", async () => {
    const res = await buildApp().fetch(new Request("http://localhost/me/customer"));
    expect(res.status).toBe(401);
  });

  it("upserts and returns the customer on first call", async () => {
    const res = await buildApp().fetch(
      new Request("http://localhost/me/customer", {
        headers: { Authorization: "Bearer tok_alice" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as CustomerBody;
    expect(body.clerkUserId).toBe("user_alice");
    expect(body.email).toBe("alice@example.com");
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("is idempotent — same customer id on repeat calls", async () => {
    const app = buildApp();
    const first = (await (
      await app.fetch(
        new Request("http://localhost/me/customer", {
          headers: { Authorization: "Bearer tok_alice" },
        }),
      )
    ).json()) as CustomerBody;
    const second = (await (
      await app.fetch(
        new Request("http://localhost/me/customer", {
          headers: { Authorization: "Bearer tok_alice" },
        }),
      )
    ).json()) as CustomerBody;
    expect(second.id).toBe(first.id);
  });

  it("updates the stored email when Clerk returns a new one", async () => {
    // First call — alice registers with her original email.
    const first = (await (
      await buildApp({ userEmail: "alice@example.com" }).fetch(
        new Request("http://localhost/me/customer", {
          headers: { Authorization: "Bearer tok_alice" },
        }),
      )
    ).json()) as CustomerBody;

    // Second call — Clerk now reports a different email for the same user.
    const second = (await (
      await buildApp({ userEmail: "alice.new@example.com" }).fetch(
        new Request("http://localhost/me/customer", {
          headers: { Authorization: "Bearer tok_alice" },
        }),
      )
    ).json()) as CustomerBody;

    expect(second.id).toBe(first.id);
    expect(second.email).toBe("alice.new@example.com");
  });

  it("returns 401 + auth_invalid on an unrecognized token", async () => {
    const res = await buildApp().fetch(
      new Request("http://localhost/me/customer", {
        headers: { Authorization: "Bearer tok_bogus" },
      }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("auth_invalid");
  });
});
