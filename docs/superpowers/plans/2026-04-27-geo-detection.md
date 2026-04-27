# Geo Detection + Country Selector + Waitlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Edge-detect the visitor's country (Vercel `request.geo.country`), persist it in a `country` cookie, and surface either the supported MX storefront or a one-time modal that captures email leads into a `waitlist_signups` table. Add a Navbar `<CountrySelector>` ready for AR fast-follow.

**Architecture:** Three layers. (1) Backend: new `waitlist_signups` table + repo + `POST /waitlist` route on Hono `apps/api`. (2) Edge: `apps/web/src/middleware.ts` gains a geo step that writes the cookie on first visit. (3) Client: `<CountryGate>` reads the cookie on mount and shows a shadcn Dialog when unsupported; `<CountrySelector>` lives in the Navbar.

**Tech Stack:** Hono + Drizzle + Postgres on the API side; Next.js 15 App Router + next-intl + shadcn/ui + Clerk on the web side. No new deps.

**Spec:** [`docs/superpowers/specs/2026-04-27-geo-detection-design.md`](../specs/2026-04-27-geo-detection-design.md)

---

## File map

### Created

| File | Responsibility |
|---|---|
| `apps/api/src/db/schema/waitlist.ts` | `waitlistSignups` table + types. |
| `apps/api/src/repos/waitlist.ts` | `upsertWaitlist(db, input)` keyed by email. |
| `apps/api/src/routes/waitlist.ts` | `POST /waitlist` factory mounted in `index.ts`. |
| `apps/api/test/db/waitlist-unique.test.ts` | UNIQUE(email) constraint. |
| `apps/api/test/repos/waitlist.test.ts` | Repo upsert behavior. |
| `apps/api/test/routes/waitlist.test.ts` | Route validation + idempotency + UA capture. |
| `apps/web/src/lib/geo.ts` | `getCountryFromRequest`, `isSupportedCountry`. |
| `apps/web/src/lib/cookies.ts` | `getCookie`, `setCookie` client helpers. |
| `apps/web/src/lib/country-names.ts` | Spanish names + `countryName(code)`. |
| `apps/web/src/components/site/country-gate.tsx` | First-visit modal with email form. |
| `apps/web/src/components/site/country-selector.tsx` | Dropdown in Navbar (single-locale today). |

### Modified

| File | Change |
|---|---|
| `apps/api/src/db/schema/index.ts` | Re-export `./waitlist`. |
| `apps/api/src/index.ts` | Mount `/waitlist` route when `db` is provided. |
| `apps/api/test/helpers/db.ts` | Add `waitlist_signups` to `resetDb` truncate list. |
| `apps/web/src/middleware.ts` | Set `country` cookie on first visit. |
| `apps/web/src/lib/api-client.ts` | Export `submitWaitlist`. |
| `apps/web/src/app/[locale]/layout.tsx` | Mount `<CountryGate />` next to `<Toaster>`. |
| `apps/web/src/components/site/navbar.tsx` | Insert `<CountrySelector>` in desktop bar + mobile sheet. |
| `apps/web/messages/es.json` | `pages.country_gate` + `site.country_selector` namespaces. |

### Generated (Drizzle output, not hand-edited)

- `apps/api/drizzle/0005_<auto-name>.sql`
- `apps/api/drizzle/meta/0005_snapshot.json`
- `apps/api/drizzle/meta/_journal.json` (updated)

---

## Task 1: Schema + migration + truncate update

**Files:**
- Create: `apps/api/src/db/schema/waitlist.ts`
- Modify: `apps/api/src/db/schema/index.ts`
- Modify: `apps/api/test/helpers/db.ts`
- Generated: `apps/api/drizzle/0005_<auto>.sql`, `meta/0005_snapshot.json`, `meta/_journal.json`

- [ ] **Step 1: Create the schema file**

`apps/api/src/db/schema/waitlist.ts`:

```ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const waitlistSignups = pgTable("waitlist_signups", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  country: text("country").notNull(),                // ISO alpha-2 uppercase
  source: text("source").notNull(),                  // unsupported_modal | navbar_selector
  detectedCountry: text("detected_country"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type WaitlistSignup = typeof waitlistSignups.$inferSelect;
export type NewWaitlistSignup = typeof waitlistSignups.$inferInsert;
```

- [ ] **Step 2: Re-export from `index.ts`**

Edit `apps/api/src/db/schema/index.ts`. Append at the end of its existing exports:

```ts
export * from "./waitlist";
```

- [ ] **Step 3: Generate the migration**

Run from repo root:

```
bun run --filter @novapatch/api db:generate
```

If Drizzle prompts about ambiguous renames, answer N — this is a fresh table, no rename. The output should be `apps/api/drizzle/0005_<some-name>.sql` plus the snapshot + journal updates.

- [ ] **Step 4: Inspect the generated SQL**

Open `apps/api/drizzle/0005_*.sql`. Verify it contains:

```sql
CREATE TABLE "waitlist_signups" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "email" text NOT NULL,
        "country" text NOT NULL,
        "source" text NOT NULL,
        "detected_country" text,
        "user_agent" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "waitlist_signups_email_unique" UNIQUE("email")
);
```

Exact phrasing may vary slightly (Drizzle's formatting), but the table, column types, and `UNIQUE("email")` constraint must all be present. If the constraint name differs, that's fine — what matters is that `email` has a unique constraint.

- [ ] **Step 5: Update the test-DB truncate list**

Edit `apps/api/test/helpers/db.ts`. The current `resetDb` truncate list is:

```ts
TRUNCATE TABLE
  payment_attempts,
  subscription_runs,
  webhook_events,
  discount_redemptions,
  discount_codes,
  subscriptions,
  order_items,
  orders,
  customers,
  influencers
RESTART IDENTITY CASCADE
```

Add `waitlist_signups` at the top (no FK dependencies, so position is purely conventional):

```ts
TRUNCATE TABLE
  waitlist_signups,
  payment_attempts,
  subscription_runs,
  webhook_events,
  discount_redemptions,
  discount_codes,
  subscriptions,
  order_items,
  orders,
  customers,
  influencers
RESTART IDENTITY CASCADE
```

- [ ] **Step 6: Run existing tests to confirm migration applies cleanly**

```
cd apps/api && bun test 2>&1 | tail -3
```

Expected: 185 pass / 0 fail (unchanged baseline).

If any test fails with "relation waitlist_signups does not exist" the migration didn't run — `useTestDb()` should pick it up automatically; check that `0005_*.sql` is committed (or at least present on disk).

- [ ] **Step 7: Commit**

```bash
cd /Users/dlucca/Projects/novapatchv2
git add apps/api/src/db/schema/ apps/api/drizzle/ apps/api/test/helpers/db.ts
git commit -m "feat(api): waitlist_signups schema + migration 0005

New table for capturing emails of visitors from unsupported countries.
UNIQUE(email) supports the upsert pattern (re-submit overwrites country).
Adds the table to resetDb truncate list."
```

---

## Task 2: Waitlist repo (TDD)

**Files:**
- Create: `apps/api/src/repos/waitlist.ts`
- Create: `apps/api/test/repos/waitlist.test.ts`
- Create: `apps/api/test/db/waitlist-unique.test.ts`

- [ ] **Step 1: Write the DB-level constraint test**

`apps/api/test/db/waitlist-unique.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { useTestDb } from "../helpers/db";
import { waitlistSignups } from "../../src/db/schema/waitlist";

describe("waitlist_signups UNIQUE(email)", () => {
  const { getDb } = useTestDb();

  it("rejects two inserts with the same email", async () => {
    const db = getDb();
    await db.insert(waitlistSignups).values({
      email: "dup@example.com",
      country: "AR",
      source: "unsupported_modal",
    });
    // Drizzle insert builders are thenables, not native Promises.
    await expect(
      Promise.resolve(
        db.insert(waitlistSignups).values({
          email: "dup@example.com",
          country: "BR",
          source: "unsupported_modal",
        }),
      ),
    ).rejects.toThrow(/waitlist_signups_email_unique/);
  });

  it("allows distinct emails in the same country", async () => {
    const db = getDb();
    await db.insert(waitlistSignups).values({
      email: "a@example.com",
      country: "AR",
      source: "unsupported_modal",
    });
    await db.insert(waitlistSignups).values({
      email: "b@example.com",
      country: "AR",
      source: "unsupported_modal",
    });
    const rows = await db.select().from(waitlistSignups);
    expect(rows.length).toBe(2);
  });
});
```

- [ ] **Step 2: Write the repo test**

`apps/api/test/repos/waitlist.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { useTestDb } from "../helpers/db";
import { waitlistSignups } from "../../src/db/schema/waitlist";
import { upsertWaitlist } from "../../src/repos/waitlist";

describe("upsertWaitlist", () => {
  const { getDb } = useTestDb();

  it("inserts a new row with inserted:true", async () => {
    const db = getDb();
    const out = await upsertWaitlist(db, {
      email: "alice@example.com",
      country: "AR",
      source: "unsupported_modal",
      detectedCountry: "AR",
      userAgent: "Mozilla/5.0",
    });
    expect(out.inserted).toBe(true);
    expect(out.id).toBeTruthy();

    const rows = await db.select().from(waitlistSignups);
    expect(rows.length).toBe(1);
    expect(rows[0]?.email).toBe("alice@example.com");
    expect(rows[0]?.country).toBe("AR");
    expect(rows[0]?.userAgent).toBe("Mozilla/5.0");
  });

  it("updates country + source on re-submit and returns inserted:false", async () => {
    const db = getDb();
    const first = await upsertWaitlist(db, {
      email: "bob@example.com",
      country: "AR",
      source: "unsupported_modal",
    });
    const second = await upsertWaitlist(db, {
      email: "bob@example.com",
      country: "BR",
      source: "navbar_selector",
      userAgent: "second-ua",
    });
    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
    expect(second.id).toBe(first.id);

    const rows = await db.select().from(waitlistSignups);
    expect(rows.length).toBe(1);
    expect(rows[0]?.country).toBe("BR");
    expect(rows[0]?.source).toBe("navbar_selector");
    expect(rows[0]?.userAgent).toBe("second-ua");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```
cd apps/api && bun test test/db/waitlist-unique.test.ts test/repos/waitlist.test.ts 2>&1 | tail -15
```

Expected: the unique test FAILS with `Cannot find module '@/db/schema/waitlist'` resolved (it should pass since schema file already exists from Task 1) but the repo test FAILS with `Cannot find module '../../src/repos/waitlist'`. If the unique test passes already (because the schema is in place), good — the repo test alone is enough to prove the missing piece.

- [ ] **Step 4: Implement the repo**

`apps/api/src/repos/waitlist.ts`:

```ts
import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { waitlistSignups, type WaitlistSignup } from "../db/schema/waitlist";

export interface UpsertWaitlistInput {
  email: string;            // pre-normalized lowercase by the route
  country: string;          // alpha-2 uppercase
  source: "unsupported_modal" | "navbar_selector";
  detectedCountry?: string;
  userAgent?: string;
}

export interface UpsertWaitlistOutput {
  id: string;
  inserted: boolean;
}

/**
 * Idempotent upsert by email. On conflict, overwrites country / source /
 * detectedCountry / userAgent / updatedAt. Returns inserted:true on insert,
 * false on update.
 */
export async function upsertWaitlist(
  db: Db,
  input: UpsertWaitlistInput,
): Promise<UpsertWaitlistOutput> {
  const values = {
    email: input.email,
    country: input.country,
    source: input.source,
    detectedCountry: input.detectedCountry ?? null,
    userAgent: input.userAgent ?? null,
  };

  const inserted = await db
    .insert(waitlistSignups)
    .values(values)
    .onConflictDoNothing({ target: waitlistSignups.email })
    .returning({ id: waitlistSignups.id });

  if (inserted[0]) {
    return { id: inserted[0].id, inserted: true };
  }

  // Conflict path: update + return existing id.
  const [row] = await db
    .update(waitlistSignups)
    .set({
      country: input.country,
      source: input.source,
      detectedCountry: input.detectedCountry ?? null,
      userAgent: input.userAgent ?? null,
      updatedAt: new Date(),
    })
    .where(eq(waitlistSignups.email, input.email))
    .returning({ id: waitlistSignups.id });

  if (!row) {
    throw new Error("upsertWaitlist: conflict path could not find existing row");
  }
  return { id: row.id, inserted: false };
}

export type { WaitlistSignup };
```

- [ ] **Step 5: Run tests to verify they pass**

```
cd apps/api && bun test test/db/waitlist-unique.test.ts test/repos/waitlist.test.ts 2>&1 | tail -10
```

Expected: PASS (4 tests across 2 files).

- [ ] **Step 6: Run full suite to confirm no regression**

```
cd apps/api && bun test 2>&1 | tail -3
```

Expected: 189 pass / 0 fail (185 + 4 new).

- [ ] **Step 7: Commit**

```bash
cd /Users/dlucca/Projects/novapatchv2
git add apps/api/src/repos/waitlist.ts apps/api/test/db/waitlist-unique.test.ts apps/api/test/repos/waitlist.test.ts
git commit -m "feat(api): waitlist repo (upsertWaitlist by email)

INSERT ... ON CONFLICT DO NOTHING + UPDATE fallback to upsert by email.
Returns inserted:true on insert, false on update. Country/source/UA
are overwritten on re-submit (last-write-wins per the spec)."
```

---

## Task 3: `POST /waitlist` route (TDD)

**Files:**
- Create: `apps/api/src/routes/waitlist.ts`
- Create: `apps/api/test/routes/waitlist.test.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Write the failing test**

`apps/api/test/routes/waitlist.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```
cd apps/api && bun test test/routes/waitlist.test.ts 2>&1 | tail -10
```

Expected: every test FAILS with 404 (the route is not mounted yet).

- [ ] **Step 3: Implement the route**

`apps/api/src/routes/waitlist.ts`:

```ts
import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../db";
import { upsertWaitlist } from "../repos/waitlist";
import { apiError } from "../lib/errors";

const BodySchema = z.object({
  email: z.string().email().toLowerCase().max(255),
  country: z.string().length(2).toUpperCase(),
  source: z.enum(["unsupported_modal", "navbar_selector"]),
  detectedCountry: z.string().length(2).toUpperCase().optional(),
});

export interface WaitlistDeps {
  db: Db;
}

export function createWaitlistRoutes(deps: WaitlistDeps): Hono {
  const r = new Hono();

  r.post("/", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      const { body, status } = apiError(
        "invalid_input",
        parsed.error.issues[0]?.message ?? "invalid request body",
        400,
      );
      return c.json(body, status);
    }

    const userAgent = (c.req.header("user-agent") ?? "").slice(0, 500) || undefined;
    const result = await upsertWaitlist(deps.db, {
      email: parsed.data.email,
      country: parsed.data.country,
      source: parsed.data.source,
      ...(parsed.data.detectedCountry ? { detectedCountry: parsed.data.detectedCountry } : {}),
      ...(userAgent ? { userAgent } : {}),
    });

    return c.json({ ok: true, inserted: result.inserted });
  });

  return r;
}
```

- [ ] **Step 4: Mount the route in `index.ts`**

Edit `apps/api/src/index.ts`. Find the existing block that mounts `/discounts`:

```ts
  if (deps.db) {
    app.route("/discounts", createDiscountRoutes(deps.db));
  }
```

Add the import at the top of the file (next to `createDiscountRoutes`):

```ts
import { createWaitlistRoutes } from "./routes/waitlist";
```

And add the mount line right after `/discounts`:

```ts
  if (deps.db) {
    app.route("/discounts", createDiscountRoutes(deps.db));
    app.route("/waitlist", createWaitlistRoutes({ db: deps.db }));
  }
```

- [ ] **Step 5: Run tests to verify they pass**

```
cd apps/api && bun test test/routes/waitlist.test.ts 2>&1 | tail -10
```

Expected: PASS (5 tests).

- [ ] **Step 6: Run full suite**

```
cd apps/api && bun test 2>&1 | tail -3
```

Expected: 194 pass / 0 fail (189 + 5 new).

- [ ] **Step 7: Commit**

```bash
cd /Users/dlucca/Projects/novapatchv2
git add apps/api/src/routes/waitlist.ts apps/api/src/index.ts apps/api/test/routes/waitlist.test.ts
git commit -m "feat(api): POST /waitlist for email lead capture

Public endpoint (no auth). Zod-validates email + country (alpha-2) +
source enum. Captures user-agent from header, truncated to 500 chars.
Returns {ok, inserted} with 200; 400 invalid_input on schema failure.
Mounted only when db dep is provided."
```

---

## Task 4: Frontend lib helpers

**Files:**
- Create: `apps/web/src/lib/geo.ts`
- Create: `apps/web/src/lib/cookies.ts`
- Create: `apps/web/src/lib/country-names.ts`

- [ ] **Step 1: Create `lib/geo.ts`**

`apps/web/src/lib/geo.ts`:

```ts
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

/**
 * Resolves the user's country from the request.
 *
 * In production on Vercel, reads request.geo.country (ISO alpha-2 uppercase).
 * In development, defaults to "MX" so local work always behaves like a
 * supported visitor.
 *
 * Returns null when geo is unavailable in non-Vercel production (e.g. host
 * without geo enrichment) — the consumer treats null as "unknown" and
 * does NOT show the modal.
 */
export function getCountryFromRequest(req: NextRequest): string | null {
  const geo = (req as unknown as { geo?: { country?: string } }).geo;
  if (geo?.country) return geo.country.toUpperCase();
  if (process.env.NODE_ENV === "development") return "MX";
  return null;
}

/**
 * True if the country (alpha-2, any case) is in routing.locales.
 * Today only "mx" matches; AR fast-follow expands automatically when
 * the locales list is updated.
 */
export function isSupportedCountry(country: string | null): boolean {
  if (!country) return false;
  const lower = country.toLowerCase();
  return (routing.locales as readonly string[]).includes(lower);
}
```

- [ ] **Step 2: Create `lib/cookies.ts`**

`apps/web/src/lib/cookies.ts`:

```ts
"use client";

/**
 * Minimal client-side cookie helpers. Server-side reading should use
 * `cookies()` from `next/headers` instead — this module is for components
 * that mount on the client.
 */

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]!) : null;
}

export function setCookie(name: string, value: string, days = 365): void {
  if (typeof document === "undefined") return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; samesite=lax`;
}
```

- [ ] **Step 3: Create `lib/country-names.ts`**

`apps/web/src/lib/country-names.ts`:

```ts
/**
 * Spanish country names for the country-gate modal copy. Keys are ISO
 * alpha-2 uppercase. Codes outside this list fall back to "tu país".
 */
export const COUNTRY_NAMES_ES: Record<string, string> = {
  AR: "Argentina",
  BR: "Brasil",
  CL: "Chile",
  CO: "Colombia",
  PE: "Perú",
  UY: "Uruguay",
  PY: "Paraguay",
  EC: "Ecuador",
  BO: "Bolivia",
  VE: "Venezuela",
  MX: "México",
  US: "Estados Unidos",
  CA: "Canadá",
  ES: "España",
};

export function countryName(code: string | null | undefined): string {
  if (!code) return "tu país";
  return COUNTRY_NAMES_ES[code.toUpperCase()] ?? "tu país";
}
```

- [ ] **Step 4: Type-check**

```
cd apps/web && bunx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/dlucca/Projects/novapatchv2
git add apps/web/src/lib/geo.ts apps/web/src/lib/cookies.ts apps/web/src/lib/country-names.ts
git commit -m "feat(web): geo + cookie + country-names lib helpers

geo.ts: getCountryFromRequest reads Vercel request.geo, defaults MX in
dev, null otherwise. isSupportedCountry checks routing.locales.
cookies.ts: getCookie/setCookie client-side wrappers (server uses
next/headers cookies()).
country-names.ts: ES dict for the modal body interpolation."
```

---

## Task 5: Middleware writes `country` cookie

**Files:**
- Modify: `apps/web/src/middleware.ts`

- [ ] **Step 1: Update the middleware**

Edit `apps/web/src/middleware.ts`. The full target file:

```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { getCountryFromRequest } from "@/lib/geo";

const intlMiddleware = createIntlMiddleware(routing);

const isProtectedRoute = createRouteMatcher(["/(.*/)?cuenta(.*)"]);

const COUNTRY_COOKIE = "country";
const COUNTRY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
  const response = intlMiddleware(req);

  // First-visit geo cookie. Existing cookie is never overwritten by middleware;
  // user explicit choices via selector / modal write directly client-side.
  if (!req.cookies.get(COUNTRY_COOKIE)) {
    const detected = getCountryFromRequest(req);
    response.cookies.set(COUNTRY_COOKIE, (detected ?? "unknown").toLowerCase(), {
      maxAge: COUNTRY_COOKIE_MAX_AGE,
      sameSite: "lax",
      path: "/",
    });
  }

  return response;
});

export const config = {
  matcher: [
    // Skip Next.js internals and static assets.
    "/((?!_next|.*\\..*).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
```

The change vs the existing file: imports `getCountryFromRequest`, captures the intl response into `response`, sets the `country` cookie when absent, returns `response` (instead of returning `intlMiddleware(req)` directly).

- [ ] **Step 2: Type-check**

```
cd apps/web && bunx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Smoke test the cookie behavior**

Start the dev server:

```
cd apps/web && bun run dev
```

Open `http://localhost:3000` (no locale segment) in a fresh browser tab (or incognito). DevTools → Application → Cookies → `localhost`. Expected:

- A cookie named `country` exists.
- Its value is `mx` (because `NODE_ENV=development` forces MX in `getCountryFromRequest`).

Delete the cookie and reload. The cookie reappears with `mx`.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
cd /Users/dlucca/Projects/novapatchv2
git add apps/web/src/middleware.ts
git commit -m "feat(web): middleware sets country cookie on first visit

Reads Vercel request.geo.country (or MX in dev) and writes the lowercase
country code to a 1-year SameSite=Lax cookie. Existing cookies are never
overwritten by middleware — user explicit choices (selector / modal)
write client-side via document.cookie."
```

---

## Task 6: API client `submitWaitlist`

**Files:**
- Modify: `apps/web/src/lib/api-client.ts`

- [ ] **Step 1: Inspect the existing api-client.ts**

```
head -30 apps/web/src/lib/api-client.ts
```

The file already has helpers like `pauseSubscription`, `resumeSubscription`, etc. and an `ApiError` class. We append a new exported function alongside them.

- [ ] **Step 2: Append `submitWaitlist`**

Open `apps/web/src/lib/api-client.ts`. At the end of the file (after the last existing export), append:

```ts
/**
 * POST /waitlist — public lead capture for unsupported countries. No auth.
 * Throws ApiError on non-2xx; otherwise returns { ok: true, inserted }.
 */
export async function submitWaitlist(args: {
  apiUrl: string;
  email: string;
  country: string;            // alpha-2; will uppercase
  source: "unsupported_modal" | "navbar_selector";
  detectedCountry?: string;
}): Promise<{ ok: true; inserted: boolean }> {
  const res = await fetch(`${args.apiUrl}/waitlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: args.email,
      country: args.country.toUpperCase(),
      source: args.source,
      ...(args.detectedCountry ? { detectedCountry: args.detectedCountry.toUpperCase() } : {}),
    }),
  });
  if (!res.ok) {
    let code = "waitlist_failed";
    try {
      const body = (await res.json()) as { error?: { code?: string } };
      if (body?.error?.code) code = body.error.code;
    } catch {
      // ignore parse errors; fall back to generic code
    }
    throw new ApiError(code, res.status);
  }
  return (await res.json()) as { ok: true; inserted: boolean };
}
```

If the file does not currently export `ApiError`, but uses one internally, double-check the import situation. The existing helpers in the file use `ApiError` — make sure your `submitWaitlist` references the same class. If `ApiError` is defined in the same file, just use it directly. If it's imported, the import already exists and you don't need to add anything.

- [ ] **Step 3: Type-check**

```
cd apps/web && bunx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd /Users/dlucca/Projects/novapatchv2
git add apps/web/src/lib/api-client.ts
git commit -m "feat(web): submitWaitlist client for POST /waitlist

Uppercases country / detectedCountry on the wire. Throws ApiError on
non-2xx, mapping the backend code when available."
```

---

## Task 7: `<CountryGate>` component + i18n + layout mount

**Files:**
- Create: `apps/web/src/components/site/country-gate.tsx`
- Modify: `apps/web/messages/es.json`
- Modify: `apps/web/src/app/[locale]/layout.tsx`

- [ ] **Step 1: Add i18n strings**

Edit `apps/web/messages/es.json`. Locate the existing `pages` and `site` namespaces and add the new entries. The merged content for the relevant slices:

Inside `site`:

```json
"site": {
  ...existing keys...,
  "country_selector": {
    "label": "País",
    "current_aria": "País actual: {country}"
  }
}
```

Inside `pages`:

```json
"pages": {
  ...existing keys...,
  "country_gate": {
    "flag_emoji": "🇲🇽",
    "title": "Pronto en tu país",
    "body": "Estamos lanzando en México. Dejanos tu email y te avisamos cuando lleguemos a {country}.",
    "email_label": "Email",
    "email_placeholder": "tu@email.com",
    "submit": "Avisame cuando lleguen",
    "submitting": "Enviando...",
    "explore_anyway": "Explorar Novapatch México igual",
    "explore_caption": "Sólo enviamos a México por ahora.",
    "toast_success": "Listo. Te avisamos cuando lleguemos a {country}.",
    "toast_error": "No pudimos guardar tu email. Probá de nuevo.",
    "validation_invalid_email": "Ingresá un email válido."
  }
}
```

Preserve the existing keys verbatim — only ADD the two new namespaces.

- [ ] **Step 2: Create the component**

`apps/web/src/components/site/country-gate.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { routing } from "@/i18n/routing";
import { getCookie, setCookie } from "@/lib/cookies";
import { countryName } from "@/lib/country-names";
import { submitWaitlist } from "@/lib/api-client";

const COUNTRY_COOKIE = "country";
const SUPPORTED_LOCALES = routing.locales as readonly string[];
const NEUTRAL_COOKIE_VALUES = new Set(["unknown", "dismissed"]);

const EmailSchema = z.string().email();

type Status = "idle" | "submitting" | "submitted";

export function CountryGate() {
  const t = useTranslations("pages.country_gate");
  const [open, setOpen] = useState(false);
  const [detected, setDetected] = useState<string>("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    const value = getCookie(COUNTRY_COOKIE);
    if (!value) return;
    if (NEUTRAL_COOKIE_VALUES.has(value)) return;
    if (SUPPORTED_LOCALES.includes(value)) return;
    setDetected(value.toUpperCase());
    setOpen(true);
  }, []);

  function handleClose(reason: "submitted" | "explored" | "dismissed") {
    if (reason === "submitted" || reason === "explored") {
      setCookie(COUNTRY_COOKIE, "mx");
    } else {
      setCookie(COUNTRY_COOKIE, "dismissed");
    }
    setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = EmailSchema.safeParse(email);
    if (!parsed.success) {
      setEmailError(t("validation_invalid_email"));
      return;
    }
    setEmailError(null);
    setStatus("submitting");

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      toast.error(t("toast_error"));
      setStatus("idle");
      return;
    }

    try {
      await submitWaitlist({
        apiUrl,
        email: parsed.data,
        country: detected,
        source: "unsupported_modal",
        detectedCountry: detected,
      });
      toast.success(t("toast_success", { country: countryName(detected) }));
      setStatus("submitted");
      handleClose("submitted");
    } catch {
      toast.error(t("toast_error"));
      setStatus("idle");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose("dismissed");
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div aria-hidden className="text-2xl mb-2">
            {t("flag_emoji")}
          </div>
          <DialogTitle className="text-h3 text-navy">{t("title")}</DialogTitle>
          <DialogDescription className="text-body text-navy/70">
            {t("body", { country: countryName(detected) })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="sr-only">{t("email_label")}</span>
            <Input
              type="email"
              placeholder={t("email_placeholder")}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              required
              disabled={status === "submitting"}
              aria-invalid={emailError ? "true" : "false"}
            />
            {emailError ? (
              <span className="mt-1 block text-caption text-coral">
                {emailError}
              </span>
            ) : null}
          </label>
          <Button
            type="submit"
            className="w-full bg-coral hover:bg-coral-light text-white"
            disabled={status === "submitting"}
          >
            {status === "submitting" ? t("submitting") : t("submit")}
          </Button>
        </form>

        <div className="mt-2 text-center">
          <button
            type="button"
            className="text-body-sm font-medium text-navy underline-offset-4 hover:underline"
            onClick={() => handleClose("explored")}
          >
            {t("explore_anyway")}
          </button>
          <p className="mt-1 text-caption text-navy/55">
            {t("explore_caption")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

If `Dialog`, `Input`, or `Button` don't exist under `@/components/ui/`, run `bunx shadcn@latest add dialog input button` from `apps/web/`. (Most likely they exist already from earlier plans — check first with `ls apps/web/src/components/ui/ | grep -E '^(dialog|input|button)'`.)

- [ ] **Step 3: Mount in the locale layout**

Edit `apps/web/src/app/[locale]/layout.tsx`. Add the import alongside the others:

```ts
import { CountryGate } from "@/components/site/country-gate";
```

Insert `<CountryGate />` between `<Footer>` and `<Toaster>`:

```tsx
<NextIntlClientProvider>
  <Navbar locale={locale} />
  {children}
  <Footer locale={locale} />
  <CountryGate />
  <Toaster position="bottom-right" richColors />
</NextIntlClientProvider>
```

- [ ] **Step 4: Type-check**

```
cd apps/web && bunx tsc --noEmit
```

Expected: PASS. If shadcn dialog/input/button were missing and you had to install them, those will need typecheck too — confirm.

- [ ] **Step 5: Smoke test**

Start dev:

```
cd apps/web && bun run dev
```

Open `http://localhost:3000/mx`. The cookie is `mx` (from middleware), so the modal should NOT open. Confirm in DevTools → no Dialog rendered, no JS errors.

DevTools → Application → Cookies → edit the `country` cookie value to `ar`. Reload `/mx`. The modal should appear, with the title "Pronto en tu país" and body interpolating "Argentina".

Type an invalid email (`abc`) and click submit. Inline error appears in coral. Modal stays open.

Stop the dev server (you'll restart it for full verification later).

- [ ] **Step 6: Commit**

```bash
cd /Users/dlucca/Projects/novapatchv2
git add apps/web/src/components/site/country-gate.tsx apps/web/messages/es.json apps/web/src/app/\[locale\]/layout.tsx
git commit -m "feat(web): CountryGate first-visit modal for unsupported countries

Reads country cookie on mount. Opens shadcn Dialog when value is an
alpha-2 not in routing.locales. Submit posts to /waitlist with
detectedCountry; success toast + sets cookie to mx. 'Explore anyway'
sets cookie mx without POST. Dismiss (X) sets cookie 'dismissed'.
Mounted once in [locale]/layout.tsx next to <Toaster>."
```

---

## Task 8: `<CountrySelector>` + Navbar integration

**Files:**
- Create: `apps/web/src/components/site/country-selector.tsx`
- Modify: `apps/web/src/components/site/navbar.tsx`

- [ ] **Step 1: Create the component**

`apps/web/src/components/site/country-selector.tsx`:

```tsx
"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { routing } from "@/i18n/routing";
import { setCookie } from "@/lib/cookies";

const LOCALE_LABELS: Record<string, { flag: string; name: string }> = {
  mx: { flag: "🇲🇽", name: "México" },
  ar: { flag: "🇦🇷", name: "Argentina" },
  br: { flag: "🇧🇷", name: "Brasil" },
  cl: { flag: "🇨🇱", name: "Chile" },
  co: { flag: "🇨🇴", name: "Colombia" },
};

interface CountrySelectorProps {
  /** When true, renders the long form ("🇲🇽 México") suitable for mobile menu rows. */
  expanded?: boolean;
}

export function CountrySelector({ expanded = false }: CountrySelectorProps) {
  const t = useTranslations("site.country_selector");
  const currentLocale = useLocale();
  const pathname = usePathname();
  const locales = routing.locales as readonly string[];
  const current = LOCALE_LABELS[currentLocale] ?? LOCALE_LABELS.mx!;

  function handleSelect(nextLocale: string) {
    if (nextLocale === currentLocale) return;
    setCookie("country", nextLocale);
    // Replace the leading /<oldLocale> with /<newLocale>; preserve the rest.
    const rest = pathname.replace(new RegExp(`^/${currentLocale}(?=/|$)`), "") || "/";
    const target = `/${nextLocale}${rest === "/" ? "" : rest}`;
    window.location.assign(target);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("current_aria", { country: current.name })}
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-body-sm font-medium text-navy/70 hover:text-navy hover:bg-navy/5 transition-colors"
      >
        <span aria-hidden>{current.flag}</span>
        {expanded ? <span>{current.name}</span> : null}
        <ChevronDown className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((loc) => {
          const label = LOCALE_LABELS[loc] ?? { flag: "🌐", name: loc.toUpperCase() };
          return (
            <DropdownMenuItem
              key={loc}
              onSelect={() => handleSelect(loc)}
              className={loc === currentLocale ? "font-semibold" : ""}
            >
              <span aria-hidden className="mr-2">{label.flag}</span>
              {label.name}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

If `dropdown-menu` does not exist under `@/components/ui/`, run from `apps/web/`:

```
bunx shadcn@latest add dropdown-menu
```

- [ ] **Step 2: Insert into the Navbar**

Read the current `apps/web/src/components/site/navbar.tsx`. The structure is roughly:

- A desktop bar with `<nav>` containing the link cluster + Clerk auth controls.
- A mobile `<Sheet>` containing a vertical link list + auth controls.

Add the import at the top:

```ts
import { CountrySelector } from "@/components/site/country-selector";
```

**Desktop placement:** find the area where the Clerk `<SignedIn>` / `<SignedOut>` buttons live (typically inside a flex row near the right edge of the bar). Insert the selector before the auth controls:

```tsx
<div className="flex items-center gap-3">
  <CountrySelector />
  <span className="hidden md:block h-5 w-px bg-navy/10" aria-hidden />
  <SignedOut>
    {/* existing buttons */}
  </SignedOut>
  <SignedIn>
    {/* existing UserButton */}
  </SignedIn>
</div>
```

The exact JSX depends on the existing structure. The goal: render `<CountrySelector />` (compact form, no `expanded`) immediately to the LEFT of the auth area on desktop, with a thin vertical divider between them.

**Mobile placement:** find the mobile `<SheetContent>` body where the link list lives. After the link list and BEFORE any auth controls inside the sheet, add a section:

```tsx
<div className="border-t border-navy/10 pt-4 mt-2">
  <CountrySelector expanded />
</div>
```

This renders the long form ("🇲🇽 México") inside the sheet, separated from the link list by a thin divider.

If the Navbar's structure makes either insertion awkward, prefer making it functional first (selector visible somewhere in both views) and adjust styling in a follow-up commit. The functional contract is what matters for this task.

- [ ] **Step 3: Type-check**

```
cd apps/web && bunx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 4: Smoke test**

Start dev (if not running):

```
cd apps/web && bun run dev
```

Open `http://localhost:3000/mx`. Expected:
- A 🇲🇽 chip with chevron is visible in the desktop Navbar near the right side.
- Clicking it opens a dropdown with one item: "🇲🇽 México" (highlighted as current).
- Clicking "México" while already on `/mx` does nothing (no-op).
- Resize the window to mobile width (< 768px). Open the hamburger Sheet. The selector renders as "🇲🇽 México" with chevron at the bottom of the menu.

There's no second locale to select today, so the navigation behavior can only be tested when AR activates. The code path is exercised by the `useLocale() === currentLocale` no-op branch.

- [ ] **Step 5: Commit**

```bash
cd /Users/dlucca/Projects/novapatchv2
git add apps/web/src/components/site/country-selector.tsx apps/web/src/components/site/navbar.tsx
git commit -m "feat(web): CountrySelector dropdown in Navbar (desktop + mobile)

Reads useLocale() for the current label; menu maps routing.locales to
flag + name. Selecting a different locale sets cookie and triggers a
full page reload at /<newLocale>/<rest> (DESIGN 4.6.2 — country change
is radical, full reload guarantees clean state).

Today with locales=['mx'] the dropdown shows one item; AR fast-follow
expands automatically when the locales list grows."
```

---

## Task 9: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Type-check both apps**

```
cd /Users/dlucca/Projects/novapatchv2/apps/api && bunx tsc --noEmit
cd /Users/dlucca/Projects/novapatchv2/apps/web && bunx tsc --noEmit
```

Both expected: PASS.

- [ ] **Step 2: Run API test suite**

```
cd /Users/dlucca/Projects/novapatchv2/apps/api && bun test 2>&1 | tail -3
```

Expected: 194 pass / 0 fail (185 baseline + 4 from Task 2 + 5 from Task 3).

- [ ] **Step 3: Build the web app**

```
cd /Users/dlucca/Projects/novapatchv2/apps/web && bun run build 2>&1 | tail -10
```

Expected: build completes, all pages compile, no missing module errors.

- [ ] **Step 4: Manual smoke flow (dev server)**

```
cd /Users/dlucca/Projects/novapatchv2/apps/web && bun run dev
```

In a fresh incognito window:

- [ ] Open `http://localhost:3000`. Get redirected to `/mx`. DevTools → Application → Cookies → `country=mx`. No modal.
- [ ] DevTools → edit cookie to `ar`. Reload `/mx`. Modal opens. Title says "Pronto en tu país". Body interpolates "Argentina".
- [ ] Type `not-an-email` and submit. Inline error appears in coral. No toast, no POST in Network.
- [ ] Type `test@example.com`. Click submit. Network tab shows `POST /waitlist` returning 200 with `{ ok: true, inserted: true }`. Toast success appears. Modal closes. Cookie is now `mx`.
- [ ] Reload `/mx`. Modal does NOT reappear.
- [ ] Edit cookie to `br`. Reload. Modal appears for Brasil. Click X. Cookie becomes `dismissed`. Modal closes.
- [ ] Reload. Modal does NOT reappear (cookie is `dismissed`).
- [ ] Edit cookie to `cl`. Reload. Modal appears. Click "Explorar Novapatch México igual". No POST in Network. Cookie becomes `mx`. Modal closes.
- [ ] Verify the database row: from a separate terminal, `psql $DATABASE_URL -c "SELECT email, country, source FROM waitlist_signups;"`. Expected: one row with `test@example.com / AR / unsupported_modal`.
- [ ] Click the country selector chip in Navbar. Dropdown opens with "🇲🇽 México" highlighted. Click it (current locale) → no navigation, dropdown closes.
- [ ] Resize to mobile (< 768px). Open hamburger menu. Selector renders as "🇲🇽 México" expanded.

- [ ] **Step 5: Stop dev server. No commit needed (verification only).**
