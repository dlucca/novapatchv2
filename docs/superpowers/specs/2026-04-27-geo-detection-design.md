# Geo Detection + Country Selector + Waitlist — Design Spec

**Status:** Approved — ready for implementation plan.
**Roadmap reference:** Plan #3 of [`docs/superpowers/ROADMAP.md`](../ROADMAP.md).
**Source-of-truth:** [`docs/superpowers/source/PRD.md`](../source/PRD.md) section 4.6.
**Scope:** Detect the visitor's country at the edge, persist it in a cookie, route MX visitors normally, route unsupported-country visitors through a modal that captures their email into a `waitlist_signups` table or lets them browse Novapatch México with a disclaimer. Add a manual country selector in the Navbar (functional with 1 locale today, ready for AR fast-follow).

---

## Goals

1. The middleware reads the visitor's country (Vercel `request.geo.country`) and writes a `country` cookie on first visit. Local development defaults to `MX`.
2. Visitors from supported countries (= `routing.locales` from next-intl, currently `["mx"]`) experience the storefront normally.
3. Visitors from unsupported countries see a modal once with two options: leave their email for the waitlist, or continue exploring the MX storefront with a clear disclaimer that shipping is MX-only.
4. The modal does not nag — once dismissed (any of the three actions: submit email, "explore anyway", X), it never shows again for that browser.
5. A `<CountrySelector>` lives in the Navbar at all times. With `["mx"]` it shows only México as an option; when AR is activated, the dropdown gains a second entry. Selecting a different country triggers a full page reload at the new locale path (cart-state-safe per DESIGN section 4.6.2).
6. Waitlist signups land in a Postgres table `waitlist_signups` keyed by email; re-submits update the country.

## Non-Goals

- Email confirmation to the lead (Resend) — Plan #13.
- Admin UI for reading the waitlist — Plan #11.
- Rate limiting on `POST /waitlist` — Plan #14.
- External geo APIs (Cloudflare, ipapi) — Vercel-only for v1 per decision Q6-A.
- Forced `?country=` URL override for QA — devtools cookie edit suffices.
- es-AR localized copy variants — single `es.json` until AR launches.
- Cart-flush on country change — no cart yet; the full reload pattern handles it naturally when Plan #4 adds the cart.

---

## Decisions log

These reflect the brainstorming Q&A on 2026-04-27:

| # | Topic | Decision |
|---|---|---|
| 1 | Plan scope | Single plan: middleware + cookie + selector + modal + waitlist backend together. |
| 2 | Definition of "supported" | Whatever is in `routing.locales` (next-intl). Today: `["mx"]`. Adding AR later requires only that list change. |
| 3 | Modal trigger | First-visit only. Dismissal sets cookie; modal never shows again until cookie cleared. |
| 4 | Country change behavior | Change URL segment + overwrite cookie + full-page reload (DESIGN 4.6.2). |
| 5 | Waitlist storage | Single table, UNIQUE(email). Re-submit overwrites country (last-write-wins). |
| 6 | Geo source | `request.geo.country` (Vercel). Localhost defaults to "MX". Unknown in non-Vercel prod = falls through to modal. |
| 7 | Modal UX | Branded: title + body + email input + primary "Avisame" + ghost "Explorar México igual" + caption disclaimer. shadcn Dialog. |

---

## Architecture

```
            ┌───────────────────────────────┐
            │  apps/web — Next.js middleware │
            │   (clerk → intl → geo cookie)  │
            └────────────────┬───────────────┘
                             │
    ┌────────────────────────┼────────────────────────┐
    │                        │                        │
    ▼                        ▼                        ▼
<CountryGate>         <CountrySelector>        existing routes
(modal client)         (Navbar dropdown)        (/[locale]/...)
    │                        │
    │                        │ navigates+reloads
    │                        ▼
    │ POST /waitlist  ←  apps/api/routes/waitlist
    └─────────────────→  ↓
                         repos/waitlist (upsert by email)
                         ↓
                         waitlist_signups table
```

---

## Backend

### Schema (`apps/api/src/db/schema/waitlist.ts`, new)

```ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const waitlistSignups = pgTable("waitlist_signups", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  country: text("country").notNull(),                // ISO alpha-2
  source: text("source").notNull(),                  // "unsupported_modal" | "navbar_selector"
  detectedCountry: text("detected_country"),         // What geo returned
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

Re-export from `apps/api/src/db/schema/index.ts`.

### Migration

Drizzle generates `0005_<auto>.sql` — `CREATE TABLE waitlist_signups (...)` plus the implicit unique index on `email`. Apply via `bun run --filter @novapatch/api db:generate` then `db:migrate`. Update `resetDb` truncate list in `apps/api/test/helpers/db.ts` to include `waitlist_signups`.

### Repo (`apps/api/src/repos/waitlist.ts`, new)

```ts
export interface UpsertWaitlistInput {
  email: string;             // pre-normalized lowercase by route
  country: string;           // alpha-2 uppercase
  source: "unsupported_modal" | "navbar_selector";
  detectedCountry?: string;
  userAgent?: string;
}

export interface UpsertWaitlistOutput {
  id: string;
  inserted: boolean;
}

export async function upsertWaitlist(
  db: Db,
  input: UpsertWaitlistInput,
): Promise<UpsertWaitlistOutput>;
```

`INSERT ... ON CONFLICT (email) DO UPDATE SET country, source, detected_country, user_agent, updated_at`. Returns `inserted: true` on insert, `false` on update.

### Route (`apps/api/src/routes/waitlist.ts`, new)

Mount under `/waitlist` in `apps/api/src/index.ts`.

```ts
const BodySchema = z.object({
  email: z.string().email().toLowerCase().max(255),
  country: z.string().length(2).toUpperCase(),
  source: z.enum(["unsupported_modal", "navbar_selector"]),
  detectedCountry: z.string().length(2).toUpperCase().optional(),
});
```

`userAgent` read from `c.req.header("user-agent")`, truncated to ~500 chars.

`POST /waitlist`:
- 400 `invalid_input` on zod failure.
- 200 `{ ok: true, inserted: boolean }` on success.
- No 409 — upsert is idempotent.

### CORS

Existing `allowHeaders` cover `Content-Type`. No auth headers needed. The `/waitlist` path inherits the global CORS config.

### Tests

- `apps/api/test/routes/waitlist.test.ts`:
  - 200 happy path.
  - 400 invalid email.
  - 400 invalid country (3-letter, lowercase, etc.).
  - Idempotent re-submit returns `inserted: false`, updates country.
  - userAgent persisted from header.
- `apps/api/test/db/waitlist-unique.test.ts`:
  - Two direct inserts with the same email throw on the second (UNIQUE on email).

---

## Frontend — middleware

### `apps/web/src/lib/geo.ts` (new)

```ts
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

/**
 * Resolves the user's country from the request.
 * In production on Vercel, reads request.geo.country (ISO alpha-2 uppercase).
 * In development, defaults to "MX" so local work always behaves like a
 * supported visitor. Returns null when geo is unavailable in non-Vercel
 * production (e.g. host without geo enrichment) — the consumer treats null
 * as "unsupported".
 */
export function getCountryFromRequest(req: NextRequest): string | null {
  const geo = (req as unknown as { geo?: { country?: string } }).geo;
  if (geo?.country) return geo.country.toUpperCase();
  if (process.env.NODE_ENV === "development") return "MX";
  return null;
}

/**
 * True if the country (alpha-2, any case) is in routing.locales.
 * Today: only "mx" matches.
 */
export function isSupportedCountry(country: string | null): boolean {
  if (!country) return false;
  const lower = country.toLowerCase();
  return (routing.locales as readonly string[]).includes(lower);
}
```

### `apps/web/src/middleware.ts` (modify)

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

  // First-visit geo cookie. Existing cookie is never overwritten by middleware
  // (user explicit choices via selector / modal write directly client-side).
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
    "/((?!_next|.*\\..*).*)",
    "/(api|trpc)(.*)",
  ],
};
```

The cookie value is lowercase (`"mx"`, `"ar"`, `"unknown"`, `"dismissed"`).

### Cookie utility (`apps/web/src/lib/cookies.ts`, new)

```ts
"use client";

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

### `apps/web/src/lib/country-names.ts` (new)

```ts
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

### API client (`apps/web/src/lib/api-client.ts`, modify)

Add `submitWaitlist`:

```ts
export async function submitWaitlist(args: {
  apiUrl: string;
  email: string;
  country: string;            // alpha-2, will uppercase
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
    throw new Error(`waitlist submit failed: ${res.status}`);
  }
  return (await res.json()) as { ok: true; inserted: boolean };
}
```

---

## Frontend — components

### `<CountryGate>` (`apps/web/src/components/site/country-gate.tsx`, new)

Client Component. Mounted once in `apps/web/src/app/[locale]/layout.tsx` next to `<Toaster>`.

State machine on mount:
1. Read `country` cookie via `getCookie("country")`.
2. If cookie value is in `routing.locales` (`"mx"`) → don't render anything.
3. If cookie value is `"dismissed"` or `"unknown"` → don't render.
4. Otherwise (cookie value is an alpha-2 like `"ar"`, `"br"`) → open the Dialog.

Modal shape (shadcn `Dialog`):

- Header: emoji 🇲🇽 + close button (X).
- Title (`text-h3 text-navy`): `t("title")` — "Pronto en tu país".
- Body (`text-body text-navy/70`): `t("body", { country: countryName(detected) })`.
- Form: shadcn `<Input type="email">` + primary `<Button>` "Avisame cuando lleguen". Validation client-side with zod (`z.string().email()`); inline error in red 12px below input on invalid.
- After form: ghost button "Explorar Novapatch México igual" + caption muted "Sólo enviamos a México por ahora."

Submit handler:
1. Validate email.
2. Call `submitWaitlist({ apiUrl, email, country: detected, source: "unsupported_modal", detectedCountry: detected })`.
3. On 2xx: sonner toast `t("toast_success", { country: countryName(detected) })`. `setCookie("country", "mx")`. Close modal.
4. On error: sonner toast `t("toast_error")`. Form stays open with email preserved.

Explore-anyway handler:
- `setCookie("country", "mx")`. Close modal. No POST.

X / dismissal handler:
- `setCookie("country", "dismissed")`. Close modal. No POST.

### `<CountrySelector>` (`apps/web/src/components/site/country-selector.tsx`, new)

Client Component. Mounted in `<Navbar>`.

- Reads the current locale from `useLocale()` (next-intl) — this drives the visible label, not the cookie. URL is the source of truth for what country the user IS viewing.
- Renders a shadcn `<DropdownMenu>` triggered by a button with `🇲🇽 ▾` (compact desktop) or `🇲🇽 México` (mobile inside the Sheet).
- Menu items map `routing.locales` to `{ mx: "🇲🇽 México", ar: "🇦🇷 Argentina", ... }` from a small lookup.
- On select:
  - If selected locale === current locale → close menu, no-op.
  - Otherwise: `setCookie("country", selectedLocale)`. Compute new path by replacing the leading `/<oldLocale>` with `/<newLocale>` (preserve everything after). `window.location.assign(newPath)` to force a full reload (DESIGN 4.6.2).

Today with `routing.locales = ["mx"]`, the dropdown only shows México. The component is functional but visually shows a single-item list. When AR activates, no code changes.

### Navbar integration (`apps/web/src/components/site/navbar.tsx`, modify)

- **Desktop**: insert `<CountrySelector>` between the link cluster and the Clerk auth controls, with a thin vertical divider on the left side.
- **Mobile**: inside the existing Sheet's nav list, append `<CountrySelector>` as a section after the links and before any auth controls.

The selector's button uses `text-body-sm font-medium text-navy/70` — quiet but discoverable.

### Layout integration (`apps/web/src/app/[locale]/layout.tsx`, modify)

Add `<CountryGate />` next to the existing `<Toaster>`:

```tsx
<NextIntlClientProvider>
  <Navbar locale={locale} />
  {children}
  <Footer locale={locale} />
  <CountryGate />
  <Toaster position="bottom-right" richColors />
</NextIntlClientProvider>
```

---

## i18n strings

`apps/web/messages/es.json` — add:

```json
{
  "site": {
    "country_selector": {
      "label": "País",
      "current_aria": "País actual: {country}"
    }
  },
  "pages": {
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
}
```

Existing `site.navbar` namespace is untouched.

---

## Testing

### Backend

- `apps/api/test/routes/waitlist.test.ts`: 200 happy path, 400 invalid email, 400 invalid country, idempotent re-submit returns `inserted: false`, userAgent persisted.
- `apps/api/test/db/waitlist-unique.test.ts`: UNIQUE(email) constraint enforced (two direct inserts → second throws).
- All existing API tests pass after schema migration.

### Frontend

No unit tests in v1. Manual smoke checklist:

- [ ] First visit on a fresh browser sets `country` cookie. (Read it in DevTools → Application → Cookies.)
- [ ] In dev, the cookie is `mx` and no modal opens.
- [ ] Edit cookie to `ar` in DevTools → reload → modal opens. Title says "Pronto en tu país". Body interpolates "Argentina".
- [ ] Submit a valid email → toast success → cookie becomes `mx` → modal closes → reload doesn't reopen.
- [ ] Click "Explorar Novapatch México igual" → cookie `mx`, no POST, modal closes.
- [ ] Click X → cookie `dismissed`, no POST, modal closes. Reload doesn't reopen.
- [ ] Submit an invalid email → inline error, modal stays open, no POST.
- [ ] DevTools → Network → kill the API → submit → toast error, modal stays open with email preserved.
- [ ] Selector in Navbar shows 🇲🇽 México. Click → dropdown opens with one item. (Multi-locale tested when AR activates.)

---

## Security & privacy

- Email is stored in plaintext (lowercase, normalized). No hashing — we need to email the user back.
- userAgent stored truncated to 500 chars. No IP storage in v1.
- `/waitlist` is unauthenticated and has no rate limiting in v1. Spam risk: low for a niche LATAM brand pre-launch. Add rate-limit in Plan #14 if needed.
- Cookie is `SameSite=Lax` (not `Strict`) so cross-site nav from email/IG link works. Not `Secure` in dev.

---

## Out-of-Scope Follow-ups

- Email confirmation to lead via Resend (Plan #13).
- Admin panel to view/export waitlist (Plan #11).
- Rate limiting on `POST /waitlist` (Plan #14).
- Cloudflare / external IP API geo as fallback for non-Vercel hosts.
- `?country=` URL override for QA.
- es-AR localized copy when AR activates.
- Dark-mode styling pass on the modal (out — site doesn't have dark mode yet).
- Country-specific currency display (handled by backend market resolution; not UI concern here).
- A/B-testable modal copy (premature for pre-launch).
- Analytics events on modal interactions (PostHog wiring is Plan #14).
