# Clerk Auth + `GET /me/customer` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify Clerk JWTs on protected endpoints, fetch the caller's email, upsert a `customers` row, and expose a first working `GET /me/customer` route that returns the authenticated customer.

**Architecture:** All Clerk interactions sit behind two small interfaces — `TokenVerifier` (JWT → `clerkUserId`) and `ClerkUserClient` (`clerkUserId` → email). Production implementations wrap `@clerk/backend`; tests inject deterministic stubs. `authMiddleware(verifier)` is a factory that takes a `TokenVerifier` and returns a Hono middleware emitting the canonical error envelope on failure. The root app becomes a `createApp(deps)` factory so `/me/*` routes (which need DB + Clerk) can be wired for production, stubbed for tests, and omitted when not needed (existing tests keep working).

**Tech Stack:** `@clerk/backend` · Hono · Drizzle · `bun:test`

**Scope of this plan (explicit):**
- Covered: `@clerk/backend` dep, `TokenVerifier` + `ClerkUserClient` types with prod + stub implementations, `authMiddleware` factory, new `auth_*` envelope codes, `createApp(deps)` factory refactor, `GET /me/customer` route, integration tests against the test DB, production wiring in `server.ts`.
- NOT covered (future plans): admin role check (Clerk roles), `/me/subscriptions/*`, `/me/payment-methods/*`, webhook signing, user caching.

**Entry state (`main` at merge commit `3d758fd`):**
- 65 tests passing (markets 10 + catalog 16 + api 39).
- `apps/api/src/env.ts` forward-declares `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` as optional strings.
- `apps/api/src/repos/customers.ts` exports `upsertCustomerByClerkUserId(db, {clerkUserId, email})`.
- `apps/api/src/lib/errors.ts` has `ApiErrorCode` union — this plan extends it.
- `apps/api/src/index.ts` currently exports `app` as a module-level Hono instance; this plan refactors it to a `createApp(deps)` factory while keeping the singleton export for backward compatibility.

**Exit criteria:**
- `GET /me/customer` with a valid JWT returns `200` with `{id, clerkUserId, email, createdAt, updatedAt}`.
- Missing / malformed / invalid Authorization → `401` + envelope `{error: {code: "auth_missing"|"auth_malformed"|"auth_invalid", message}}`.
- Calling the endpoint twice returns the same `customer.id` (upsert idempotent).
- Changing the caller's email in Clerk changes `customer.email` on the next call.
- `pnpm typecheck` + `pnpm test` green end-to-end.
- Test count: 65 → ~79.

---

## File Structure

```
novapatchv2/
├── apps/api/
│   ├── package.json                          # MODIFY — add @clerk/backend
│   ├── src/
│   │   ├── index.ts                          # MODIFY — createApp(deps) factory
│   │   ├── server.ts                         # MODIFY — build prod deps, call createApp(deps)
│   │   ├── lib/
│   │   │   ├── errors.ts                     # MODIFY — add auth_missing/malformed/invalid codes
│   │   │   └── clerk.ts                      # NEW — TokenVerifier + ClerkUserClient + impls + stubs
│   │   ├── middleware/
│   │   │   └── auth.ts                       # NEW — authMiddleware factory
│   │   ├── routes/
│   │   │   └── me.ts                         # NEW — createMeRoutes(verifier, userClient, db)
│   │   └── types/
│   │       └── hono.d.ts                     # MODIFY — add clerkUserId to ContextVariableMap
│   └── test/
│       ├── lib/
│       │   ├── errors.test.ts                # MODIFY — include new auth codes in the list
│       │   └── clerk.test.ts                 # NEW — stub verifier + stub user client tests
│       ├── middleware/
│       │   └── auth.test.ts                  # NEW — authMiddleware behavior
│       └── routes/
│           └── me.test.ts                    # NEW — integration against real DB
```

**File responsibilities:**
- `lib/clerk.ts` owns the thin wrappers around `@clerk/backend` + the stubs tests depend on. No middleware or route code.
- `middleware/auth.ts` is a pure factory: `(verifier) → MiddlewareHandler`. No environment reads, no DB.
- `routes/me.ts` is a factory: `(verifier, userClient, db) → Hono`. Owns the upsert flow for `GET /customer`.
- `index.ts` exposes `createApp(deps)` — all cross-cutting setup (logger, cors, error handlers, always-on routes) happens inside. If `deps` includes `verifier/userClient/db`, `/me/*` is mounted; otherwise omitted. A module-level `export const app = createApp()` keeps existing tests (`app.fetch`) working.
- `server.ts` reads env, instantiates prod verifier / user client / db, calls `createApp(deps)`, starts `Bun.serve`.

---

## Task 1: Clerk Library — interfaces, prod impls, stubs (TDD on stubs)

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/src/lib/clerk.ts`
- Create: `apps/api/test/lib/clerk.test.ts`

- [ ] **Step 1.1: Add `@clerk/backend` dep**

In `apps/api/package.json`, add `"@clerk/backend": "^1.17.0"` under `dependencies`. Then from repo root:

```bash
pnpm install
```

Expected: installs `@clerk/backend`, updates lockfile.

- [ ] **Step 1.2: Write failing tests for the stub factories**

Create `apps/api/test/lib/clerk.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import {
  createStubVerifier,
  createStubUserClient,
} from "../../src/lib/clerk";

describe("createStubVerifier", () => {
  it("returns the configured payload for a known token", async () => {
    const verifier = createStubVerifier({
      "tok_alice": { clerkUserId: "user_alice" },
    });
    const result = await verifier.verify("tok_alice");
    expect(result.clerkUserId).toBe("user_alice");
  });

  it("throws for an unknown token", async () => {
    const verifier = createStubVerifier({});
    await expect(verifier.verify("tok_missing")).rejects.toThrow(/invalid|unknown/i);
  });
});

describe("createStubUserClient", () => {
  it("returns the configured user for a known id", async () => {
    const client = createStubUserClient({
      "user_alice": { clerkUserId: "user_alice", email: "alice@example.com" },
    });
    const user = await client.getUser("user_alice");
    expect(user.email).toBe("alice@example.com");
  });

  it("throws for an unknown user id", async () => {
    const client = createStubUserClient({});
    await expect(client.getUser("user_missing")).rejects.toThrow(/not found|unknown/i);
  });
});
```

- [ ] **Step 1.3: Run; verify FAIL**

```bash
export PATH="$HOME/.bun/bin:$PATH"
pnpm --filter @novapatch/api test
```
Expected: FAIL — `Cannot find module '../../src/lib/clerk'`.

- [ ] **Step 1.4: Create `apps/api/src/lib/clerk.ts`**

```typescript
import { createClerkClient, verifyToken } from "@clerk/backend";

export interface VerifiedToken {
  clerkUserId: string;
}

export interface TokenVerifier {
  /**
   * Verifies a JWT. On success resolves with the Clerk user id (from the `sub` claim).
   * On any failure (expired, malformed, invalid signature, revoked) rejects.
   */
  verify(token: string): Promise<VerifiedToken>;
}

export interface ClerkUser {
  clerkUserId: string;
  email: string;
}

export interface ClerkUserClient {
  /**
   * Fetches the Clerk user's profile and returns the primary email.
   * Throws if the user doesn't exist or has no primary email configured.
   */
  getUser(clerkUserId: string): Promise<ClerkUser>;
}

// ---------- Production implementations ----------

export function createClerkVerifier(opts: { secretKey: string }): TokenVerifier {
  return {
    async verify(token) {
      const payload = await verifyToken(token, { secretKey: opts.secretKey });
      if (typeof payload.sub !== "string" || payload.sub.length === 0) {
        throw new Error("verified token has no `sub` claim");
      }
      return { clerkUserId: payload.sub };
    },
  };
}

export function createClerkUserClient(opts: { secretKey: string }): ClerkUserClient {
  const clerk = createClerkClient({ secretKey: opts.secretKey });
  return {
    async getUser(clerkUserId) {
      const user = await clerk.users.getUser(clerkUserId);
      const primary = user.emailAddresses.find(
        (e) => e.id === user.primaryEmailAddressId,
      );
      if (!primary) {
        throw new Error(`Clerk user ${clerkUserId} has no primary email`);
      }
      return { clerkUserId, email: primary.emailAddress };
    },
  };
}

// ---------- Test stubs ----------

/**
 * Map of `token → payload`. `verify(token)` returns the mapped payload or throws.
 * Used only in tests.
 */
export function createStubVerifier(
  tokens: Record<string, VerifiedToken>,
): TokenVerifier {
  return {
    async verify(token) {
      const payload = tokens[token];
      if (!payload) {
        throw new Error(`invalid token: ${token}`);
      }
      return payload;
    },
  };
}

/**
 * Map of `userId → user`. `getUser(id)` returns the mapped user or throws.
 * Used only in tests.
 */
export function createStubUserClient(
  users: Record<string, ClerkUser>,
): ClerkUserClient {
  return {
    async getUser(clerkUserId) {
      const user = users[clerkUserId];
      if (!user) {
        throw new Error(`user not found: ${clerkUserId}`);
      }
      return user;
    },
  };
}
```

- [ ] **Step 1.5: Run; verify PASS**

```bash
pnpm --filter @novapatch/api test
```
Expected: 4 new tests green. Total: 39 → 43 in apps/api.

- [ ] **Step 1.6: Typecheck**

```bash
pnpm --filter @novapatch/api typecheck
```
Expected: clean.

- [ ] **Step 1.7: Commit**

```bash
git add apps/api/package.json apps/api/src/lib/clerk.ts apps/api/test/lib/clerk.test.ts pnpm-lock.yaml
git commit -m "feat(api): Clerk lib — TokenVerifier + ClerkUserClient with prod impls + stubs"
```

---

## Task 2: Auth Middleware + new error codes (TDD)

**Files:**
- Modify: `apps/api/src/lib/errors.ts` — add `auth_missing`, `auth_malformed`, `auth_invalid` to `ApiErrorCode`
- Modify: `apps/api/test/lib/errors.test.ts` — include new codes in the documented list
- Modify: `apps/api/src/types/hono.d.ts` — add `clerkUserId: string` to `ContextVariableMap`
- Create: `apps/api/src/middleware/auth.ts`
- Create: `apps/api/test/middleware/auth.test.ts`

- [ ] **Step 2.1: Extend `ApiErrorCode` union in `apps/api/src/lib/errors.ts`**

Read the file. Replace the `ApiErrorCode` type with:

```typescript
export type ApiErrorCode =
  | "market_missing"
  | "market_empty"
  | "market_unknown"
  | "product_not_found"
  | "not_found"
  | "internal_error"
  | "validation_failed"
  | "auth_missing"
  | "auth_malformed"
  | "auth_invalid";
```

- [ ] **Step 2.2: Update the documented-codes test in `apps/api/test/lib/errors.test.ts`**

Find the test `"accepts all documented codes"`. Replace its `codes` array with:

```typescript
    const codes: ApiErrorCode[] = [
      "market_missing",
      "market_empty",
      "market_unknown",
      "product_not_found",
      "not_found",
      "internal_error",
      "validation_failed",
      "auth_missing",
      "auth_malformed",
      "auth_invalid",
    ];
```

Run: `pnpm --filter @novapatch/api test` — expect 43 pass (test count unchanged; the array just grew).

- [ ] **Step 2.3: Extend `hono.d.ts` ContextVariableMap**

Read `apps/api/src/types/hono.d.ts`. Replace its `ContextVariableMap` block with:

```typescript
import type { Market } from "@novapatch/markets";

// Central registry for Hono ContextVariableMap augmentations.
// Add new keys here as the API grows.
declare module "hono" {
  interface ContextVariableMap {
    market: Market;
    clerkUserId: string;
  }
}

export {};
```

- [ ] **Step 2.4: Write failing tests for authMiddleware**

Create `apps/api/test/middleware/auth.test.ts`:

```typescript
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
```

- [ ] **Step 2.5: Run; verify FAIL**

```bash
pnpm --filter @novapatch/api test
```
Expected: FAIL — `Cannot find module '../../src/middleware/auth'`.

- [ ] **Step 2.6: Create `apps/api/src/middleware/auth.ts`**

```typescript
import type { MiddlewareHandler } from "hono";
import type { TokenVerifier } from "../lib/clerk";
import { apiError } from "../lib/errors";

const BEARER = /^Bearer\s+(\S+)\s*$/;

/**
 * Factory returning a Hono middleware that:
 *   - reads `Authorization: Bearer <jwt>` from the request
 *   - delegates JWT verification to the provided TokenVerifier
 *   - on success attaches `clerkUserId` to the Hono context
 *   - on failure returns a 401 with the canonical error envelope
 *
 * The verifier is injected so tests can pass a stub and production can pass
 * a real Clerk-backed verifier.
 */
export function authMiddleware(verifier: TokenVerifier): MiddlewareHandler {
  return async (c, next) => {
    const header = c.req.header("Authorization");
    if (!header) {
      const { body, status } = apiError(
        "auth_missing",
        "Authorization header is required",
        401,
      );
      return c.json(body, status);
    }
    const match = header.match(BEARER);
    if (!match || !match[1]) {
      const { body, status } = apiError(
        "auth_malformed",
        "Authorization header must be 'Bearer <token>'",
        401,
      );
      return c.json(body, status);
    }
    const token = match[1];
    try {
      const { clerkUserId } = await verifier.verify(token);
      c.set("clerkUserId", clerkUserId);
      await next();
    } catch {
      const { body, status } = apiError(
        "auth_invalid",
        "token could not be verified",
        401,
      );
      return c.json(body, status);
    }
  };
}
```

- [ ] **Step 2.7: Run; verify PASS**

```bash
pnpm --filter @novapatch/api test
```
Expected: 5 new middleware tests pass. Total: 43 → 48.

- [ ] **Step 2.8: Typecheck**

```bash
pnpm --filter @novapatch/api typecheck
```
Expected: clean.

- [ ] **Step 2.9: Commit**

```bash
git add apps/api/src/lib/errors.ts apps/api/test/lib/errors.test.ts apps/api/src/types/hono.d.ts apps/api/src/middleware/auth.ts apps/api/test/middleware/auth.test.ts
git commit -m "feat(api): authMiddleware + auth_* error codes + clerkUserId context"
```

---

## Task 3: `createApp(deps)` factory refactor

**Files:**
- Modify: `apps/api/src/index.ts`

> This task restructures the app wiring so `/me/*` can mount when deps are provided, without breaking any existing test that imports the module-level `app`.

- [ ] **Step 3.1: Refactor `apps/api/src/index.ts`**

Read the current file, then replace it entirely with:

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { healthRoutes } from "./routes/health";
import { catalogRoutes } from "./routes/catalog";
import { apiError } from "./lib/errors";
import { readEnv } from "./env";
import type { TokenVerifier, ClerkUserClient } from "./lib/clerk";
import type { Db } from "./db";

export interface AppDeps {
  verifier?: TokenVerifier;
  userClient?: ClerkUserClient;
  db?: Db;
}

// Root application factory.
// Always mounts: logger, cors, error handlers, /health, /catalog.
// Conditionally mounts /me/* when all auth+db deps are provided.
//
// Convention: the mount prefix lives HERE; route modules use bare paths
// internally. e.g. `app.route("/catalog", catalogRoutes)`
// + `catalogRoutes.get("/", ...)` → `/catalog`. One routing table of contents
// in this file.

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

export function createApp(deps: AppDeps = {}): Hono {
  const env = readEnv();
  const app = new Hono();

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

  // /me/* is wired in Task 4 once the factory exists.
  // Guarded so tests that don't pass deps still work.
  if (deps.verifier && deps.userClient && deps.db) {
    // placeholder — Task 4 adds the actual mount
  }

  return app;
}

// Backward-compatible singleton for existing tests that do
// `import { app } from "../src/index"`. No deps → /me is omitted.
export const app = createApp();
```

- [ ] **Step 3.2: Run; verify all existing tests still PASS**

```bash
pnpm --filter @novapatch/api test
```
Expected: 48 pass (same as Task 2). No regressions.

- [ ] **Step 3.3: Typecheck**

```bash
pnpm --filter @novapatch/api typecheck
```
Expected: clean.

- [ ] **Step 3.4: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "refactor(api): createApp(deps) factory with optional /me wiring"
```

---

## Task 4: `/me/customer` route + integration tests (TDD)

**Files:**
- Create: `apps/api/src/routes/me.ts`
- Create: `apps/api/test/routes/me.test.ts`
- Modify: `apps/api/src/index.ts` — replace the placeholder in the `createApp` guard with the real mount

- [ ] **Step 4.1: Write failing integration tests**

Create `apps/api/test/routes/me.test.ts`:

```typescript
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
```

- [ ] **Step 4.2: Run; verify FAIL**

```bash
pnpm --filter @novapatch/api test
```
Expected: FAIL — `Cannot find module '../../src/routes/me'` AND/OR `createApp` never mounts `/me/*` (placeholder). The missing route should return `not_found` 404 with a JSON error envelope — NOT 200 — so the happy-path test fails.

- [ ] **Step 4.3: Create `apps/api/src/routes/me.ts`**

```typescript
import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import type { TokenVerifier, ClerkUserClient } from "../lib/clerk";
import type { Db } from "../db";
import { upsertCustomerByClerkUserId } from "../repos/customers";
import type { Customer } from "../db/schema/customers";

function serializeCustomer(c: Customer) {
  return {
    id: c.id,
    clerkUserId: c.clerkUserId,
    email: c.email,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

/**
 * Factory for the `/me/*` route module. Takes explicit deps so tests can
 * inject stubs and production wires the real Clerk-backed clients.
 *
 * Protected: every route inside is guarded by `authMiddleware(verifier)`.
 */
export function createMeRoutes(
  verifier: TokenVerifier,
  userClient: ClerkUserClient,
  db: Db,
): Hono {
  const me = new Hono();

  me.use("*", authMiddleware(verifier));

  me.get("/customer", async (c) => {
    const clerkUserId = c.get("clerkUserId");
    const { email } = await userClient.getUser(clerkUserId);
    const customer = await upsertCustomerByClerkUserId(db, {
      clerkUserId,
      email,
    });
    return c.json(serializeCustomer(customer));
  });

  return me;
}
```

- [ ] **Step 4.4: Wire the mount in `apps/api/src/index.ts`**

Find this block in `createApp`:

```typescript
  // /me/* is wired in Task 4 once the factory exists.
  // Guarded so tests that don't pass deps still work.
  if (deps.verifier && deps.userClient && deps.db) {
    // placeholder — Task 4 adds the actual mount
  }
```

Replace with:

```typescript
  if (deps.verifier && deps.userClient && deps.db) {
    app.route("/me", createMeRoutes(deps.verifier, deps.userClient, deps.db));
  }
```

And add the import alongside the other route imports at the top of the file:

```typescript
import { createMeRoutes } from "./routes/me";
```

- [ ] **Step 4.5: Run; verify PASS**

```bash
pnpm --filter @novapatch/api test
```
Expected: 5 new `/me/customer` tests pass. Total: 48 → 53.

If tests still fail with `DATABASE_URL_TEST is required`, confirm the `.env` symlink exists at `apps/api/.env` per the README setup instructions.

- [ ] **Step 4.6: Typecheck**

```bash
pnpm --filter @novapatch/api typecheck
```
Expected: clean.

- [ ] **Step 4.7: Commit**

```bash
git add apps/api/src/routes/me.ts apps/api/test/routes/me.test.ts apps/api/src/index.ts
git commit -m "feat(api): GET /me/customer — upsert on first call, idempotent after"
```

---

## Task 5: Production wiring in `server.ts`

**Files:**
- Modify: `apps/api/src/server.ts`

- [ ] **Step 5.1: Replace `apps/api/src/server.ts`**

```typescript
import { createApp } from "./index";
import { readEnv } from "./env";
import { createClerkVerifier, createClerkUserClient } from "./lib/clerk";
import { createDb } from "./db";

const env = readEnv();

if (!env.CLERK_SECRET_KEY) {
  throw new Error(
    "CLERK_SECRET_KEY is required to start the API server. Set it in .env (see .env.example).",
  );
}
if (!env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required to start the API server. Set it in .env (see .env.example).",
  );
}

const verifier = createClerkVerifier({ secretKey: env.CLERK_SECRET_KEY });
const userClient = createClerkUserClient({ secretKey: env.CLERK_SECRET_KEY });
const { db } = createDb(env.DATABASE_URL);

const app = createApp({ verifier, userClient, db });

const server = Bun.serve({
  port: env.PORT,
  fetch: (req) => app.fetch(req),
});

console.log(`api listening on http://localhost:${server.port}`);
```

- [ ] **Step 5.2: Smoke-test the production wiring (optional)**

Requires a valid Clerk secret + running Clerk project. If available:

```bash
export CLERK_SECRET_KEY="sk_test_..."
export DATABASE_URL="postgres://novapatch:novapatch@localhost:5433/novapatch"
pnpm --filter @novapatch/api dev
```

Expected: `api listening on http://localhost:9000`. A browser-generated JWT from the frontend will round-trip `GET /me/customer`.

If no Clerk key is available, skip — the integration tests in Task 4 already exercise the full flow against stubs.

- [ ] **Step 5.3: Run the full test suite one more time end-to-end**

```bash
pnpm test
```
Expected:
- `@novapatch/markets`: 10
- `@novapatch/catalog`: 16
- `@novapatch/api`: 53
- **Total: 79**

Typecheck:
```bash
pnpm typecheck
```
Expected: clean.

- [ ] **Step 5.4: Commit**

```bash
git add apps/api/src/server.ts
git commit -m "feat(api): wire Clerk verifier + user client + db into server.ts"
```

---

## Exit Criteria for This Plan

- `GET /me/customer` with a valid bearer token returns `200` and a customer row; first call creates, subsequent calls return the same id.
- Missing / malformed / invalid bearer returns `401` with the canonical envelope and a precise `code` (`auth_missing`, `auth_malformed`, `auth_invalid`).
- `createApp(deps)` factory is the entry point; module-level `app = createApp()` keeps existing tests working.
- `@clerk/backend` is wrapped behind `TokenVerifier` + `ClerkUserClient` so every test is stubbable.
- 79 tests passing total; typecheck clean.
- Clerk secret key is enforced at process boot (clear error if missing) but unset config is still OK for tests.
- 5 focused commits.

## Next Plan (not part of this one)

**Pricing engine + discount validation:**
- Pure pricing function: cart items + market + discount code → `{subtotal, tax, shipping, discountAmount, total}`.
- `POST /discounts/validate` — body `{code, market, subtotal}` → `{valid, discountPct, appliesTo}` with structured error envelope for disabled / expired / market-mismatch / below-minimum.
- Repo layer for `discount_codes` with `findByCodeForMarket(code, market)`.
- Follow-ups from DB plan land here: unique indexes on `discount_redemptions` and `lower(code)` on `discount_codes`, plus a Zod-at-the-boundary convention note.
