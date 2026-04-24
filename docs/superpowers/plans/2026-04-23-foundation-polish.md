# Foundation Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address the 5 cross-cutting follow-ups flagged in the foundation branch's final code review — error envelope, error handlers, CORS, logger, expanded env schema, and CI — so the API is production-shape before DB/auth/checkout land.

**Architecture:** Small, surgical additions. A shared `errors.ts` module with a typed envelope + helper lives in `apps/api/src/lib/`. `app.onError` and `app.notFound` use that helper. Middleware (`hono/cors`, `hono/logger`) is mounted once in `apps/api/src/index.ts`. The env schema in `apps/api/src/env.ts` grows to cover upcoming DB/auth/payment keys, with a matching `.env.example` committed at the repo root. A minimal GitHub Actions workflow gates every PR on `pnpm typecheck && pnpm test`.

**Tech Stack:** Hono (`hono/cors`, `hono/logger`) · Zod · `bun:test` · GitHub Actions

**Scope of this plan (explicit):**
- Covered: error envelope + helper, `onError`/`notFound`, CORS, request logging, env schema expansion, `.env.example`, CI workflow, migration of existing 400/404 responses to the new envelope.
- NOT covered (future plans): Drizzle + DB schema, Clerk auth middleware, checkout, admin endpoints, webhooks.

**Entry state (main branch at commit `7a655c2`):**
- 42 tests passing across `@novapatch/markets`, `@novapatch/catalog`, `@novapatch/api`.
- Existing error responses use a plain `{error: string}` shape at `apps/api/src/middleware/market.ts` (3 sites) and `apps/api/src/routes/catalog.ts` (1 site).
- `apps/api/src/env.ts` validates only `PORT` and `NODE_ENV`.

**Exit criteria:**
- New error envelope type + helper used everywhere a 4xx/5xx body is emitted.
- `app.onError` returns a 500 envelope; `app.notFound` returns a 404 envelope.
- Browser request from a non-same-origin frontend succeeds (CORS preflight OK) for allowed origins.
- Every request logs one line with method + path + status + duration.
- `pnpm test` still green; tests updated to match the new envelope shape.
- `.env.example` committed with all variables the next plan will consume.
- GitHub Actions workflow exists and passes on its own commit.

---

## File Structure

```
novapatchv2/
├── .env.example                              # NEW — template of all env vars
├── .github/
│   └── workflows/
│       └── ci.yml                            # NEW — pnpm install → typecheck → test
├── apps/api/
│   ├── src/
│   │   ├── env.ts                            # MODIFY — expand schema
│   │   ├── index.ts                          # MODIFY — mount cors, logger, onError, notFound
│   │   ├── lib/
│   │   │   └── errors.ts                     # NEW — ApiErrorCode + apiError() helper
│   │   ├── middleware/
│   │   │   └── market.ts                     # MODIFY — use apiError() for its 3 responses
│   │   └── routes/
│   │       └── catalog.ts                    # MODIFY — use apiError() for its 404
│   └── test/
│       ├── lib/
│       │   └── errors.test.ts                # NEW — unit tests for apiError()
│       ├── catalog.test.ts                   # MODIFY — assert new envelope shape
│       ├── health.test.ts                    # MODIFY — assert envelope for unknown path
│       ├── middleware/
│       │   └── market.test.ts                # MODIFY — assert new envelope for 400s
│       ├── error-handlers.test.ts            # NEW — onError/notFound behavior
│       └── cors.test.ts                      # NEW — preflight + actual request
```

**File responsibilities:**
- `apps/api/src/lib/errors.ts` owns the typed error envelope and a `apiError(code, message, status)` helper. Nothing else goes in here.
- `apps/api/src/index.ts` becomes the single place middleware and handlers are mounted. Test expectations get enforced here.
- `apps/api/src/middleware/market.ts` and `apps/api/src/routes/catalog.ts` switch from plain strings to envelope helper calls — behavior identical, shape changes.
- `.env.example` documents all variables in one canonical place so `apps/web` and deployment scripts have something to reference.

---

## Task 1: Error Envelope Helper (TDD)

**Files:**
- Create: `apps/api/src/lib/errors.ts`
- Create: `apps/api/test/lib/errors.test.ts`

- [ ] **Step 1.1: Write failing test**

Create `apps/api/test/lib/errors.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { apiError, type ApiErrorCode } from "../../src/lib/errors";

describe("apiError", () => {
  it("returns the expected envelope with status code", () => {
    const { body, status } = apiError("market_missing", "missing ?market query parameter", 400);
    expect(status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "market_missing",
        message: "missing ?market query parameter",
      },
    });
  });

  it("preserves numeric status codes as-is", () => {
    const { status: s404 } = apiError("product_not_found", "x", 404);
    const { status: s500 } = apiError("internal_error", "x", 500);
    expect(s404).toBe(404);
    expect(s500).toBe(500);
  });

  it("accepts all documented codes", () => {
    const codes: ApiErrorCode[] = [
      "market_missing",
      "market_empty",
      "market_unknown",
      "product_not_found",
      "not_found",
      "internal_error",
      "validation_failed",
    ];
    for (const code of codes) {
      const { body } = apiError(code, "msg", 400);
      expect(body.error.code).toBe(code);
    }
  });
});
```

- [ ] **Step 1.2: Run the test; verify FAIL**

Run: `export PATH="$HOME/.bun/bin:$PATH" && pnpm --filter @novapatch/api test`
Expected: FAIL — `Cannot find module '../../src/lib/errors'`.

- [ ] **Step 1.3: Create `apps/api/src/lib/errors.ts`**

```typescript
/**
 * Stable, client-facing error codes. Add new codes here as the API grows.
 * The codes are semantic identifiers the frontend can branch on — they
 * should not change once shipped. The message is human-readable and may
 * change freely.
 */
export type ApiErrorCode =
  | "market_missing"
  | "market_empty"
  | "market_unknown"
  | "product_not_found"
  | "not_found"
  | "internal_error"
  | "validation_failed";

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

export interface ApiErrorResult {
  body: ApiErrorBody;
  status: number;
}

/**
 * Builds a typed error envelope. Call `c.json(...apiError(...))` in Hono handlers,
 * or spread the result manually when a handler needs more control.
 */
export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
): ApiErrorResult {
  return {
    body: { error: { code, message } },
    status,
  };
}
```

- [ ] **Step 1.4: Run the test; verify PASS**

Run: `pnpm --filter @novapatch/api test`
Expected: PASS — 3 new assertions.

- [ ] **Step 1.5: Typecheck**

Run: `pnpm --filter @novapatch/api typecheck`
Expected: clean.

- [ ] **Step 1.6: Commit**

```bash
git add apps/api/src/lib apps/api/test/lib
git commit -m "feat(api): typed error envelope helper"
```

---

## Task 2: Wire `onError` + `notFound` Handlers (TDD)

**Files:**
- Create: `apps/api/test/error-handlers.test.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 2.1: Write failing test**

Create `apps/api/test/error-handlers.test.ts`:

```typescript
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
```

- [ ] **Step 2.2: Run; verify FAIL**

Run: `pnpm --filter @novapatch/api test`
Expected: FAIL — `registerErrorHandlers is not a function` (or similar export error).

- [ ] **Step 2.3: Update `apps/api/src/index.ts`**

Replace the file with:

```typescript
import { Hono } from "hono";
import { healthRoutes } from "./routes/health";
import { catalogRoutes } from "./routes/catalog";
import { apiError } from "./lib/errors";

// Root application. Route modules live in ./routes/*.ts and are mounted below.
// Convention: the mount prefix lives HERE; route modules use bare paths internally.
// e.g. `app.route("/catalog", catalogRoutes)` + `catalogRoutes.get("/", ...)` → `/catalog`.
// This gives us a single routing table of contents in this file.

/**
 * Attaches the canonical error envelope to `notFound` and `onError` on the given app.
 * Exported so tests can wire it onto a fresh Hono instance without reimporting `app`.
 */
export function registerErrorHandlers(target: Hono): void {
  target.notFound((c) => {
    const { body, status } = apiError("not_found", `route not found: ${c.req.path}`, 404);
    return c.json(body, status);
  });

  target.onError((err, c) => {
    console.error("[api:onError]", err);
    const { body, status } = apiError(
      "internal_error",
      "an internal error occurred",
      500,
    );
    return c.json(body, status);
  });
}

export const app = new Hono();

registerErrorHandlers(app);

app.route("/", healthRoutes);
app.route("/catalog", catalogRoutes);
```

- [ ] **Step 2.4: Run; verify the new tests PASS**

Run: `pnpm --filter @novapatch/api test`
Expected: 3 new assertions pass. But the existing `default 404` test in `test/health.test.ts` will now FAIL — it asserts `status === 404` only, which still passes, but if it inspects body it will. Check the file to be sure.

- [ ] **Step 2.5: Update `apps/api/test/health.test.ts` to assert the new envelope shape**

Replace the contents of `apps/api/test/health.test.ts` with:

```typescript
import { describe, it, expect } from "bun:test";
import { app } from "../src/index";

type HealthBody = { status: string };
type ErrorBody = { error: { code: string; message: string } };

describe("GET /health", () => {
  it("returns 200 with ok status", async () => {
    const res = await app.fetch(new Request("http://localhost/health"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as HealthBody;
    expect(body).toEqual({ status: "ok" });
  });

  it("sets JSON content-type", async () => {
    const res = await app.fetch(new Request("http://localhost/health"));
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });
});

describe("default 404", () => {
  it("returns 404 with the canonical error envelope for unknown paths", async () => {
    const res = await app.fetch(new Request("http://localhost/does-not-exist"));
    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("not_found");
    expect(body.error.message).toMatch(/not found/i);
  });
});
```

- [ ] **Step 2.6: Run; verify all tests PASS**

Run: `pnpm --filter @novapatch/api test`
Expected: PASS — all previous tests + 3 error-handler tests. Total: was 16, now 19.

- [ ] **Step 2.7: Typecheck**

Run: `pnpm --filter @novapatch/api typecheck`
Expected: clean.

- [ ] **Step 2.8: Commit**

```bash
git add apps/api/src/index.ts apps/api/test/error-handlers.test.ts apps/api/test/health.test.ts
git commit -m "feat(api): onError + notFound return canonical error envelope"
```

---

## Task 3: Migrate Existing 4xx Responses to the Envelope (TDD)

**Files:**
- Modify: `apps/api/src/middleware/market.ts`
- Modify: `apps/api/src/routes/catalog.ts`
- Modify: `apps/api/test/middleware/market.test.ts`
- Modify: `apps/api/test/catalog.test.ts`

- [ ] **Step 3.1: Update the middleware tests FIRST (Red)**

Replace `apps/api/test/middleware/market.test.ts` with:

```typescript
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
```

- [ ] **Step 3.2: Run; verify middleware tests FAIL**

Run: `pnpm --filter @novapatch/api test`
Expected: FAIL — middleware tests fail because `body.error.code` is undefined (response is still `{error: string}`).

- [ ] **Step 3.3: Update `apps/api/src/middleware/market.ts` to emit the envelope**

Replace the file with:

```typescript
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
```

- [ ] **Step 3.4: Run; verify middleware tests PASS**

Run: `pnpm --filter @novapatch/api test`
Expected: 6 middleware tests pass. Catalog tests may now fail where they asserted the old shape — handle in the next steps.

- [ ] **Step 3.5: Update `apps/api/test/catalog.test.ts` to expect the envelope on the 404**

Modify the existing `"returns 404 for unknown slug"` test in `apps/api/test/catalog.test.ts`. Find this block:

```typescript
  it("returns 404 for unknown slug", async () => {
    const res = await app.fetch(new Request("http://localhost/catalog/unknown?market=mx"));
    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorBody;
    expect(body.error).toMatch(/not found/i);
  });
```

Replace it with:

```typescript
  it("returns 404 + code=product_not_found for unknown slug", async () => {
    const res = await app.fetch(new Request("http://localhost/catalog/unknown?market=mx"));
    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("product_not_found");
    expect(body.error.message).toMatch(/not found/i);
  });
```

Also update the `ErrorBody` type declaration near the top of the same file. Find:

```typescript
type ErrorBody = { error: string };
```

Replace with:

```typescript
type ErrorBody = { error: { code: string; message: string } };
```

- [ ] **Step 3.6: Update `apps/api/src/routes/catalog.ts` to emit the envelope on the 404**

Open `apps/api/src/routes/catalog.ts`. Find this line:

```typescript
    return c.json({ error: `product not found: ${slug}` }, 404);
```

Replace with:

```typescript
    const { body, status } = apiError(
      "product_not_found",
      `product not found: ${slug}`,
      404,
    );
    return c.json(body, status);
```

And add the import at the top of the file:

```typescript
import { apiError } from "../lib/errors";
```

(Add it alongside the other imports — the existing imports already include `marketMiddleware`, so place it nearby.)

- [ ] **Step 3.7: Run; verify all tests PASS**

Run: `pnpm --filter @novapatch/api test`
Expected: PASS. Counts: was 19, unchanged at 19 (we modified tests, did not add more).

- [ ] **Step 3.8: Typecheck**

Run: `pnpm --filter @novapatch/api typecheck`
Expected: clean.

- [ ] **Step 3.9: Commit**

```bash
git add apps/api/src/middleware/market.ts apps/api/src/routes/catalog.ts apps/api/test
git commit -m "refactor(api): migrate existing 400/404 responses to error envelope"
```

---

## Task 4: CORS Middleware (TDD)

**Files:**
- Create: `apps/api/test/cors.test.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/env.ts`

- [ ] **Step 4.1: Write failing test**

Create `apps/api/test/cors.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { app } from "../src/index";

describe("CORS", () => {
  it("allows localhost:3000 (storefront) with credentials on GET", async () => {
    const res = await app.fetch(
      new Request("http://localhost/catalog?market=mx", {
        headers: { Origin: "http://localhost:3000" },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("responds 204 to preflight OPTIONS from allowed origin", async () => {
    const res = await app.fetch(
      new Request("http://localhost/catalog?market=mx", {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:3000",
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "authorization,content-type",
        },
      }),
    );
    // Hono's cors helper returns 204 on preflight
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    expect(res.headers.get("access-control-allow-methods")).toMatch(/GET/);
    expect(res.headers.get("access-control-allow-headers")).toMatch(/authorization/i);
  });

  it("does NOT reflect a disallowed origin", async () => {
    const res = await app.fetch(
      new Request("http://localhost/catalog?market=mx", {
        headers: { Origin: "https://evil.example.com" },
      }),
    );
    // Request still succeeds, but the browser will enforce: ACAO must NOT equal the evil origin.
    expect(res.headers.get("access-control-allow-origin")).not.toBe("https://evil.example.com");
  });
});
```

- [ ] **Step 4.2: Run; verify FAIL**

Run: `pnpm --filter @novapatch/api test`
Expected: FAIL — CORS headers are absent; first assertion fails with `null`.

- [ ] **Step 4.3: Update `apps/api/src/env.ts` to parse `CORS_ORIGINS`**

Replace the file with:

```typescript
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(9000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /**
   * Comma-separated list of allowed CORS origins.
   * Dev default: localhost:3000 (storefront). Override in prod via env.
   */
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((s) =>
      s
        .split(",")
        .map((o) => o.trim())
        .filter((o) => o.length > 0),
    ),
});

export type Env = z.infer<typeof envSchema>;

export function readEnv(source: Record<string, string | undefined> = process.env): Env {
  return envSchema.parse(source);
}
```

- [ ] **Step 4.4: Mount CORS in `apps/api/src/index.ts`**

Replace the file with:

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { healthRoutes } from "./routes/health";
import { catalogRoutes } from "./routes/catalog";
import { apiError } from "./lib/errors";
import { readEnv } from "./env";

// Root application. Route modules live in ./routes/*.ts and are mounted below.
// Convention: the mount prefix lives HERE; route modules use bare paths internally.
// e.g. `app.route("/catalog", catalogRoutes)` + `catalogRoutes.get("/", ...)` → `/catalog`.
// This gives us a single routing table of contents in this file.

/**
 * Attaches the canonical error envelope to `notFound` and `onError` on the given app.
 * Exported so tests can wire it onto a fresh Hono instance without reimporting `app`.
 */
export function registerErrorHandlers(target: Hono): void {
  target.notFound((c) => {
    const { body, status } = apiError("not_found", `route not found: ${c.req.path}`, 404);
    return c.json(body, status);
  });

  target.onError((err, c) => {
    console.error("[api:onError]", err);
    const { body, status } = apiError(
      "internal_error",
      "an internal error occurred",
      500,
    );
    return c.json(body, status);
  });
}

const env = readEnv();

export const app = new Hono();

app.use(
  "*",
  cors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
    maxAge: 600,
  }),
);

registerErrorHandlers(app);

app.route("/", healthRoutes);
app.route("/catalog", catalogRoutes);
```

- [ ] **Step 4.5: Run; verify CORS tests PASS**

Run: `pnpm --filter @novapatch/api test`
Expected: PASS — 3 CORS tests green. Total: 22.

- [ ] **Step 4.6: Smoke-test preflight manually (optional but recommended)**

Start: `pnpm --filter @novapatch/api dev`

In another shell:

```bash
curl -i -X OPTIONS 'http://localhost:9000/catalog?market=mx' \
  -H 'Origin: http://localhost:3000' \
  -H 'Access-Control-Request-Method: GET'
```

Expected: `HTTP/1.1 204` with `Access-Control-Allow-Origin: http://localhost:3000`.

Stop the server.

- [ ] **Step 4.7: Typecheck**

Run: `pnpm --filter @novapatch/api typecheck`
Expected: clean.

- [ ] **Step 4.8: Commit**

```bash
git add apps/api/src/env.ts apps/api/src/index.ts apps/api/test/cors.test.ts
git commit -m "feat(api): CORS middleware with CORS_ORIGINS env override"
```

---

## Task 5: Request Logger

No TDD on the logger itself (asserting log output is noisy and brittle); we verify by smoke test and a single regression test that logger middleware doesn't break existing behavior.

**Files:**
- Modify: `apps/api/src/index.ts`

- [ ] **Step 5.1: Add logger to `apps/api/src/index.ts`**

In the file you just wrote in Task 4, add the import and mount the logger **before** the CORS mount so every request — including preflights — is logged. Insert the import alongside the existing hono imports:

```typescript
import { logger } from "hono/logger";
```

And add this `app.use` call **immediately after** `export const app = new Hono();`, before the `cors` mount:

```typescript
app.use("*", logger());
```

The final relevant block of `apps/api/src/index.ts` should read:

```typescript
const env = readEnv();

export const app = new Hono();

app.use("*", logger());

app.use(
  "*",
  cors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
    maxAge: 600,
  }),
);

registerErrorHandlers(app);

app.route("/", healthRoutes);
app.route("/catalog", catalogRoutes);
```

- [ ] **Step 5.2: Run all tests; verify still PASS**

Run: `pnpm --filter @novapatch/api test`
Expected: all 22 tests pass. Log lines may appear in the test output — that's expected and fine.

- [ ] **Step 5.3: Smoke-test the logger**

Start: `pnpm --filter @novapatch/api dev`

In another shell:
```bash
curl -s 'http://localhost:9000/health' > /dev/null
curl -s 'http://localhost:9000/catalog?market=mx' > /dev/null
curl -s 'http://localhost:9000/does-not-exist' > /dev/null
```

Expected: the dev server logs three lines, one per request, each showing method, path, status, and timing (Hono's default logger format). Stop the server.

- [ ] **Step 5.4: Typecheck**

Run: `pnpm --filter @novapatch/api typecheck`
Expected: clean.

- [ ] **Step 5.5: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "feat(api): request logger middleware"
```

---

## Task 6: Expand Env Schema + `.env.example`

**Files:**
- Modify: `apps/api/src/env.ts`
- Create: `.env.example` (at repo root)
- Modify: `apps/api/test/health.test.ts` (add one env test) — actually: new file for env tests.
- Create: `apps/api/test/env.test.ts`

- [ ] **Step 6.1: Write failing test for expanded schema**

Create `apps/api/test/env.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { readEnv } from "../src/env";

describe("readEnv", () => {
  it("accepts the minimum required vars and returns defaults", () => {
    const env = readEnv({});
    expect(env.PORT).toBe(9000);
    expect(env.NODE_ENV).toBe("development");
    expect(env.CORS_ORIGINS).toEqual(["http://localhost:3000"]);
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.CLERK_SECRET_KEY).toBeUndefined();
  });

  it("parses CORS_ORIGINS from a comma-separated list and trims", () => {
    const env = readEnv({ CORS_ORIGINS: " https://novapatch.com , https://staging.novapatch.com " });
    expect(env.CORS_ORIGINS).toEqual([
      "https://novapatch.com",
      "https://staging.novapatch.com",
    ]);
  });

  it("accepts DATABASE_URL, CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY as optional strings", () => {
    const env = readEnv({
      DATABASE_URL: "postgres://user:pass@host:5432/db",
      CLERK_SECRET_KEY: "sk_test_123",
      CLERK_PUBLISHABLE_KEY: "pk_test_123",
    });
    expect(env.DATABASE_URL).toBe("postgres://user:pass@host:5432/db");
    expect(env.CLERK_SECRET_KEY).toBe("sk_test_123");
    expect(env.CLERK_PUBLISHABLE_KEY).toBe("pk_test_123");
  });

  it("accepts payment provider keys", () => {
    const env = readEnv({
      OPENPAY_MERCHANT_ID: "mid",
      OPENPAY_PRIVATE_KEY: "sk_123",
      OPENPAY_PUBLIC_KEY: "pk_123",
      MERCADOPAGO_ACCESS_TOKEN: "TEST-abc",
    });
    expect(env.OPENPAY_MERCHANT_ID).toBe("mid");
    expect(env.OPENPAY_PRIVATE_KEY).toBe("sk_123");
    expect(env.OPENPAY_PUBLIC_KEY).toBe("pk_123");
    expect(env.MERCADOPAGO_ACCESS_TOKEN).toBe("TEST-abc");
  });

  it("rejects negative PORT", () => {
    expect(() => readEnv({ PORT: "-1" })).toThrow();
  });

  it("rejects NODE_ENV outside the enum", () => {
    expect(() => readEnv({ NODE_ENV: "staging" })).toThrow();
  });
});
```

- [ ] **Step 6.2: Run; verify FAIL**

Run: `pnpm --filter @novapatch/api test`
Expected: FAIL — `DATABASE_URL`, `CLERK_SECRET_KEY`, etc. don't exist on the inferred `Env` type (compile fail) or return undefined in unexpected ways.

- [ ] **Step 6.3: Expand `apps/api/src/env.ts`**

Replace the file with:

```typescript
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(9000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /**
   * Comma-separated list of allowed CORS origins.
   * Dev default: localhost:3000 (storefront). Override in prod via env.
   */
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((s) =>
      s
        .split(",")
        .map((o) => o.trim())
        .filter((o) => o.length > 0),
    ),

  // Forward declarations — consumed by later plans (DB, auth, payments, email).
  // Kept optional here so the API boots without them until each subsystem lands.
  DATABASE_URL: z.string().optional(),

  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),

  OPENPAY_MERCHANT_ID: z.string().optional(),
  OPENPAY_PRIVATE_KEY: z.string().optional(),
  OPENPAY_PUBLIC_KEY: z.string().optional(),

  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADOPAGO_PUBLIC_KEY: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),

  ENVIA_API_KEY: z.string().optional(),

  SENTRY_DSN: z.string().optional(),
  POSTHOG_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function readEnv(source: Record<string, string | undefined> = process.env): Env {
  return envSchema.parse(source);
}
```

- [ ] **Step 6.4: Run; verify tests PASS**

Run: `pnpm --filter @novapatch/api test`
Expected: PASS — 6 new env tests. Total: 28.

- [ ] **Step 6.5: Create `.env.example` at the repo root**

Create `/Users/dlucca/Projects/novapatchv2/.env.example`:

```
# Novapatch v2 — environment template.
# Copy to .env and fill in real values for local development.
# .env is gitignored; .env.example is committed.

# ----- API server -----
PORT=9000
NODE_ENV=development

# Comma-separated list of allowed CORS origins (browser-facing).
CORS_ORIGINS=http://localhost:3000

# ----- Database (next plan) -----
# Postgres connection string. Leave blank until the DB plan lands.
DATABASE_URL=

# ----- Auth: Clerk -----
CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=

# ----- Payments: Openpay (Mexico) -----
OPENPAY_MERCHANT_ID=
OPENPAY_PRIVATE_KEY=
OPENPAY_PUBLIC_KEY=

# ----- Payments: MercadoPago (BR/AR/CL/CO) -----
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_PUBLIC_KEY=

# ----- Transactional email: Resend -----
RESEND_API_KEY=

# ----- Shipping: Envia (Mexico) -----
ENVIA_API_KEY=

# ----- Observability -----
SENTRY_DSN=
POSTHOG_API_KEY=
```

- [ ] **Step 6.6: Typecheck**

Run: `pnpm --filter @novapatch/api typecheck`
Expected: clean.

- [ ] **Step 6.7: Commit**

```bash
git add apps/api/src/env.ts apps/api/test/env.test.ts .env.example
git commit -m "feat(api): expand env schema for DB/auth/payments/email/observability + .env.example"
```

---

## Task 7: GitHub Actions CI Workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 7.1: Create the workflow**

Create `/Users/dlucca/Projects/novapatchv2/.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.1.x

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm typecheck

      - name: Test
        run: pnpm test
```

- [ ] **Step 7.2: Verify YAML syntax locally**

Run from the repo root: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`
Expected: no output, exit code 0. If Python isn't available, skip — GitHub will validate on push. (If yaml parses fail, fix indentation before committing.)

- [ ] **Step 7.3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: pnpm install → typecheck → test on PR and push to main"
```

- [ ] **Step 7.4: Verify full workspace is still green**

Run from repo root:
```bash
export PATH="$HOME/.bun/bin:$PATH"
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
```

Expected:
- `pnpm install --frozen-lockfile` completes with no lockfile drift.
- `pnpm typecheck` clean.
- `pnpm test` shows: `@novapatch/markets` 10 pass, `@novapatch/catalog` 16 pass, `@novapatch/api` 28 pass. Total 54.

- [ ] **Step 7.5: Final commit note (only if something slipped)**

If any lockfile update or small fix was needed in Step 7.4, amend-commit it:

```bash
git add -u
git commit -m "chore: sync lockfile after foundation polish"
```

Otherwise skip this step.

---

## Exit Criteria for This Plan

- Total tests: 54 passing (was 42). Breakdown:
  - `@novapatch/markets`: 10 (unchanged)
  - `@novapatch/catalog`: 16 (unchanged)
  - `@novapatch/api`: 28 (was 16): 3 health + 3 error-handlers + 6 middleware + 7 catalog + 3 CORS + 6 env.
- `pnpm typecheck` clean across all packages.
- New public shape of every 4xx/5xx response: `{error: {code, message}}`.
- `.env.example` committed with all variables the next plans will consume.
- `.github/workflows/ci.yml` exists and (once pushed to a branch/PR) runs typecheck + test.
- Seven focused commits land cleanly on a single feature branch.

## Next Plan (not part of this one)

The **DB + Drizzle + Clerk auth** plan:
- Drizzle setup, initial migration generating all 7 tables from the spec.
- Connection pool, test-DB helper (either Testcontainers or a dedicated Bun test DB).
- Clerk JWT middleware on `/me/*` and `/admin/*`.
- First protected endpoint skeleton (e.g. `GET /me` returning the authenticated customer's vault summary).
