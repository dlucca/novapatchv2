import { describe, it, expect } from "bun:test";
import { useTestDb } from "../helpers/db";
import { createApp } from "../../src/index";
import { waitlistSignups } from "../../src/db/schema/waitlist";

function buildApp(getDb: ReturnType<typeof useTestDb>["getDb"]) {
  return createApp({ db: getDb() });
}

function postWaitlist(
  app: ReturnType<typeof createApp>,
  body: unknown,
  opts: { userAgent?: string } = {},
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.userAgent) headers["User-Agent"] = opts.userAgent;
  return app.fetch(
    new Request("http://localhost/waitlist", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /waitlist", () => {
  const { getDb } = useTestDb();

  it("200 happy path inserts a row and returns inserted:true", async () => {
    const app = buildApp(getDb);
    const res = await postWaitlist(
      app,
      {
        email: "Alice@Example.com",
        country: "ar",
        source: "unsupported_modal",
        detectedCountry: "ar",
      },
      { userAgent: "Test-Agent/1.0" },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; inserted: boolean };
    expect(body.ok).toBe(true);
    expect(body.inserted).toBe(true);

    const rows = await getDb().select().from(waitlistSignups);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe("alice@example.com");        // lowercased
    expect(rows[0]?.country).toBe("AR");                      // uppercased
    expect(rows[0]?.detectedCountry).toBe("AR");
    expect(rows[0]?.source).toBe("unsupported_modal");
    expect(rows[0]?.userAgent).toBe("Test-Agent/1.0");
  });

  it("idempotent re-submit returns inserted:false and updates country", async () => {
    const app = buildApp(getDb);
    await postWaitlist(app, {
      email: "carol@example.com",
      country: "AR",
      source: "unsupported_modal",
    });
    const res = await postWaitlist(app, {
      email: "carol@example.com",
      country: "BR",
      source: "navbar_selector",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; inserted: boolean };
    expect(body.inserted).toBe(false);

    const rows = await getDb().select().from(waitlistSignups);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.country).toBe("BR");
    expect(rows[0]?.source).toBe("navbar_selector");
  });

  it("400 invalid email", async () => {
    const app = buildApp(getDb);
    const res = await postWaitlist(app, {
      email: "not-an-email",
      country: "AR",
      source: "unsupported_modal",
    });
    expect(res.status).toBe(400);
  });

  it("400 invalid country (3 letters)", async () => {
    const app = buildApp(getDb);
    const res = await postWaitlist(app, {
      email: "foo@example.com",
      country: "ARG",
      source: "unsupported_modal",
    });
    expect(res.status).toBe(400);
  });

  it("400 invalid source", async () => {
    const app = buildApp(getDb);
    const res = await postWaitlist(app, {
      email: "foo@example.com",
      country: "AR",
      source: "marketing_email",
    });
    expect(res.status).toBe(400);
  });
});
