# Frontend Bootstrap + `/cuenta` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `apps/web` as a Next.js 15 + React 19 + Tailwind v4 + Clerk + next-intl + shadcn/ui project, and port one protected page (`/mx/cuenta`) that fetches `GET /me/customer` from the backend and displays the authenticated customer.

**Architecture:** Next.js App Router under `apps/web/`. Locale segment `[locale]/` — start with one locale (`mx` → Spanish) to keep this plan focused. Root middleware composes Clerk (auth + protect `/cuenta`) with next-intl (locale routing). Server Components fetch data using the caller's Clerk JWT (`auth().getToken()`) and call the backend at `NEXT_PUBLIC_API_URL`. A thin `lib/api.ts` wraps `fetch`, parses the error envelope, and returns typed results. shadcn/ui components are copied into `components/ui/` via the CLI. Later plans will add more locales, more `/me/*` pages, and port the full storefront.

**Tech Stack:** Next.js 15 · React 19 · TypeScript · Tailwind CSS v4 · `@clerk/nextjs` v6 · `next-intl` v4 · shadcn/ui · `bun:test` (for API client unit tests)

**Scope of this plan (explicit):**
- Covered: `apps/web` bootstrap, Tailwind v4, Clerk integration + middleware, next-intl with `mx` locale, shadcn/ui init, API client with unit tests, `/mx/cuenta` Server Component, `.env.example` + README updates, CI extension for frontend typecheck.
- NOT covered (future plans): additional locales (`br`, `ar`, `cl`, `co`), home/landing page content, storefront (`/tienda`), checkout, other `/me/*` pages, static legal pages, admin, i18n for error messages.

**Entry state (`main` at commit `c7ed5d6`):**
- 79 tests passing (markets 10 + catalog 16 + api 53).
- Backend exposes `GET /me/customer` (Clerk JWT required).
- `apps/web/` does NOT exist.
- `pnpm-workspace.yaml` already globs `apps/*` so a new `apps/web` package is picked up automatically.
- `.env.example` has `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` placeholder but no `NEXT_PUBLIC_API_URL`.

**Exit criteria:**
- `pnpm --filter @novapatch/web dev` starts Next.js on `http://localhost:3000`.
- Root path `/` redirects to `/mx`.
- `/mx` renders a minimal home with a Clerk sign-in button.
- `/mx/cuenta` without auth redirects to Clerk sign-in.
- `/mx/cuenta` signed-in fetches the backend and renders customer `{id, email, created-at}` inside a shadcn `Card`.
- `pnpm --filter @novapatch/web typecheck` clean.
- `pnpm --filter @novapatch/web test` green (API client unit tests).
- Root `pnpm test` still green end-to-end (existing 79 + new frontend unit tests).
- CI runs frontend typecheck + test.

---

## File Structure

```
novapatchv2/
├── .env.example                                   # MODIFY — add NEXT_PUBLIC_API_URL
├── .github/workflows/ci.yml                       # MODIFY — typecheck + test pass through
├── README.md                                      # MODIFY — add frontend section
└── apps/
    └── web/                                        # NEW — all below
        ├── package.json                            # NEW
        ├── tsconfig.json                           # NEW (extends root base)
        ├── next.config.ts                          # NEW
        ├── postcss.config.mjs                      # NEW (Tailwind v4 plugin)
        ├── middleware.ts                           # NEW (Clerk + next-intl composed)
        ├── components.json                         # NEW (shadcn config)
        ├── messages/
        │   └── es.json                             # NEW (home + cuenta strings)
        ├── src/
        │   ├── app/
        │   │   ├── globals.css                     # NEW (@import tailwindcss + shadcn vars)
        │   │   └── [locale]/
        │   │       ├── layout.tsx                  # NEW (ClerkProvider + next-intl provider)
        │   │       ├── page.tsx                    # NEW (minimal home)
        │   │       └── cuenta/
        │   │           └── page.tsx                # NEW (protected, fetches /me/customer)
        │   ├── i18n/
        │   │   ├── routing.ts                      # NEW (locales + default)
        │   │   └── request.ts                      # NEW (getRequestConfig)
        │   ├── lib/
        │   │   ├── api.ts                          # NEW (fetchCustomer etc.)
        │   │   └── utils.ts                        # NEW (shadcn cn())
        │   └── components/
        │       └── ui/
        │           ├── button.tsx                  # NEW (shadcn)
        │           └── card.tsx                    # NEW (shadcn)
        └── test/
            └── lib/
                └── api.test.ts                     # NEW (fetchCustomer tests)
```

**File responsibilities:**
- `package.json` owns the Next.js + React + deps surface. Scripts: `dev`, `build`, `start`, `test`, `typecheck`.
- `middleware.ts` is the SINGLE middleware — composes Clerk (route protection) with next-intl (locale rewriting). Any new protected route gets added to the `isProtectedRoute` matcher.
- `src/i18n/routing.ts` + `src/i18n/request.ts` own locale config. Easy to extend to `br/ar/cl/co` later.
- `src/lib/api.ts` is the ONE place the web app talks to the backend. Typed error envelope parsing lives here. Future pages import from here.
- `src/lib/utils.ts` is the shadcn `cn()` helper — expected location.
- `src/components/ui/*` is shadcn component storage — expected location per `components.json`.
- `src/app/[locale]/` is the App Router tree. Every route is locale-scoped.

---

## Task 1: Next.js 15 + Tailwind v4 bootstrap

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/src/app/globals.css`
- Create: `apps/web/src/app/layout.tsx` (temporary — moved under `[locale]` in Task 3)
- Create: `apps/web/src/app/page.tsx` (temporary — moved under `[locale]` in Task 3)

- [ ] **Step 1.1: Create `apps/web/package.json`**

```json
{
  "name": "@novapatch/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start --port 3000",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^15.2.8",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.12.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.6.2"
  }
}
```

- [ ] **Step 1.2: Create `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "incremental": true,
    "allowJs": false,
    "noEmit": true,
    "plugins": [
      { "name": "next" }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "src/**/*", "test/**/*", ".next/types/**/*.ts", "middleware.ts"],
  "exclude": ["node_modules", ".next"]
}
```

> Note: `lib` is extended to include `DOM` for the web app (unlike backend). `bun-types` is deliberately NOT here — Next.js runs on Node at build time; `bun test` picks up `bun:test` fine without global types if the test file imports them.

- [ ] **Step 1.3: Create `apps/web/next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

- [ ] **Step 1.4: Create `apps/web/postcss.config.mjs`**

```javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 1.5: Create `apps/web/src/app/globals.css`**

```css
@import "tailwindcss";

body {
  font-family: system-ui, -apple-system, sans-serif;
}
```

- [ ] **Step 1.6: Create `apps/web/src/app/layout.tsx` (temporary — will move in Task 3)**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Novapatch",
  description: "Parches vitamínicos por suscripción.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 1.7: Create `apps/web/src/app/page.tsx` (temporary — will move in Task 3)**

```tsx
export default function Home() {
  return (
    <main className="min-h-screen p-12">
      <h1 className="text-4xl font-bold">Novapatch</h1>
      <p className="mt-4 text-gray-600">Bootstrap en progreso.</p>
    </main>
  );
}
```

- [ ] **Step 1.8: Install deps from repo root**

```bash
pnpm install
```

Expected: installs `next`, `react`, `react-dom`, `tailwindcss`, `@tailwindcss/postcss`, `@types/*`. Updates `pnpm-lock.yaml`.

- [ ] **Step 1.9: Smoke-test the dev server**

```bash
export PATH="$HOME/.bun/bin:$PATH"
pnpm --filter @novapatch/web dev &
DEV_PID=$!
sleep 5
curl -s http://localhost:3000 | head -c 400
kill $DEV_PID 2>/dev/null || true
wait $DEV_PID 2>/dev/null || true
```

Expected: HTML output containing `<h1 class="text-4xl font-bold">Novapatch</h1>`. If `next dev` fails, STOP and report the error.

- [ ] **Step 1.10: Typecheck**

```bash
pnpm --filter @novapatch/web typecheck
```

Expected: clean. (On first run `tsc` may generate `.next/` types — let it.)

- [ ] **Step 1.11: Update root `.gitignore` for `.next/`**

Read the root `.gitignore`. If it does NOT already have `.next`, append:

```
.next
next-env.d.ts
```

- [ ] **Step 1.12: Commit**

```bash
git add apps/web/package.json apps/web/tsconfig.json apps/web/next.config.ts apps/web/postcss.config.mjs apps/web/src .gitignore pnpm-lock.yaml
git commit -m "feat(web): bootstrap Next.js 15 + React 19 + Tailwind v4"
```

---

## Task 2: Clerk authentication integration

**Files:**
- Modify: `apps/web/package.json` — add `@clerk/nextjs`
- Modify: `apps/web/src/app/layout.tsx` — wrap with `ClerkProvider` + add header nav
- Create: `apps/web/src/middleware.ts` — protect `/cuenta` routes via Clerk

- [ ] **Step 2.1: Add `@clerk/nextjs` dep**

In `apps/web/package.json`, add under `dependencies`: `"@clerk/nextjs": "^6.5.0"`.

```bash
pnpm install
```

Expected: installs `@clerk/nextjs`.

- [ ] **Step 2.2: Wrap the root layout with `ClerkProvider` + add header nav**

Replace `apps/web/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/nextjs";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Novapatch",
  description: "Parches vitamínicos por suscripción.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="es">
        <body>
          <header className="flex items-center justify-between border-b border-gray-200 p-4">
            <Link href="/" className="text-lg font-semibold">
              Novapatch
            </Link>
            <div className="flex items-center gap-4">
              <SignedIn>
                <Link href="/cuenta" className="text-sm text-gray-700 hover:underline">
                  Mi cuenta
                </Link>
                <UserButton />
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="rounded bg-black px-3 py-1.5 text-sm font-medium text-white">
                    Iniciar sesión
                  </button>
                </SignInButton>
              </SignedOut>
            </div>
          </header>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 2.3: Create `apps/web/src/middleware.ts`**

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Any path that ends with /cuenta (optionally followed by more segments) is protected.
// The leading `(.*/)?` allows the match to fire whether or not a locale prefix is present.
const isProtectedRoute = createRouteMatcher(["/(.*/)?cuenta(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
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

- [ ] **Step 2.4: Typecheck**

```bash
pnpm --filter @novapatch/web typecheck
```

Expected: clean.

- [ ] **Step 2.5: Smoke-test — verify sign-in button renders**

Requires `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in the env. If the `.env.example` entry is blank, use a placeholder (Clerk will render in "missing key" mode which still shows the button markup).

Create a temporary `apps/web/.env.local` (gitignored) with at least:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_placeholder
```

Then:

```bash
pnpm --filter @novapatch/web dev &
DEV_PID=$!
sleep 5
curl -s http://localhost:3000 | grep -q "Iniciar sesi" && echo "OK: button rendered" || echo "FAIL"
kill $DEV_PID 2>/dev/null || true
wait $DEV_PID 2>/dev/null || true
```

Expected: `OK: button rendered`. If Clerk throws a hard error about an invalid key, that's OK — the HTML is still produced up to the provider check. If the header nav is missing entirely, investigate.

Then delete the temporary file: `rm apps/web/.env.local`.

- [ ] **Step 2.6: Commit**

```bash
git add apps/web/package.json apps/web/src/app/layout.tsx apps/web/src/middleware.ts pnpm-lock.yaml
git commit -m "feat(web): Clerk integration — ClerkProvider + cuenta route protection"
```

---

## Task 3: next-intl i18n with `[locale]/` segment (mx only)

**Files:**
- Modify: `apps/web/package.json` — add `next-intl`
- Create: `apps/web/src/i18n/routing.ts`
- Create: `apps/web/src/i18n/request.ts`
- Create: `apps/web/messages/es.json`
- Modify: `apps/web/next.config.ts` — add the next-intl plugin
- Modify: `apps/web/src/middleware.ts` — compose with `createIntlMiddleware`
- MOVE: `apps/web/src/app/layout.tsx` → `apps/web/src/app/[locale]/layout.tsx`
- MOVE: `apps/web/src/app/page.tsx` → `apps/web/src/app/[locale]/page.tsx`

- [ ] **Step 3.1: Add `next-intl` dep**

In `apps/web/package.json`, add under `dependencies`: `"next-intl": "^4.9.0"`.

```bash
pnpm install
```

- [ ] **Step 3.2: Create `apps/web/src/i18n/routing.ts`**

```typescript
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["mx"],
  defaultLocale: "mx",
  localePrefix: "always",
});
```

> Only one locale for now. Additional LATAM locales (`br`, `ar`, `cl`, `co`) land in a future plan.

- [ ] **Step 3.3: Create `apps/web/src/i18n/request.ts`**

```typescript
import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${localeToFile(locale)}.json`)).default,
  };
});

function localeToFile(locale: string): string {
  // All LATAM markets currently map to Spanish messages.
  // `br` (not yet added) will map to `pt` when introduced.
  return "es";
}
```

- [ ] **Step 3.4: Create `apps/web/messages/es.json`**

```json
{
  "home": {
    "title": "Novapatch",
    "subtitle": "Parches vitamínicos por suscripción.",
    "cta_cuenta": "Ver mi cuenta"
  },
  "cuenta": {
    "title": "Mi cuenta",
    "email_label": "Correo",
    "member_since_label": "Cliente desde",
    "loading": "Cargando..."
  },
  "nav": {
    "mi_cuenta": "Mi cuenta",
    "iniciar_sesion": "Iniciar sesión"
  }
}
```

- [ ] **Step 3.5: Update `apps/web/next.config.ts` to add the next-intl plugin**

Replace the file with:

```typescript
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default withNextIntl(nextConfig);
```

- [ ] **Step 3.6: Move the existing `layout.tsx` and `page.tsx` under `[locale]/`**

```bash
mkdir -p apps/web/src/app/\[locale\]
git mv apps/web/src/app/layout.tsx apps/web/src/app/\[locale\]/layout.tsx
git mv apps/web/src/app/page.tsx apps/web/src/app/\[locale\]/page.tsx
```

- [ ] **Step 3.7: Update `apps/web/src/app/[locale]/layout.tsx` to wire `NextIntlClientProvider` + locale-aware params**

Replace the file with:

```tsx
import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/nextjs";
import Link from "next/link";
import { routing } from "@/i18n/routing";
import "../globals.css";

export const metadata: Metadata = {
  title: "Novapatch",
  description: "Parches vitamínicos por suscripción.",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const t = await getTranslations({ locale, namespace: "nav" });

  return (
    <ClerkProvider>
      <html lang={locale}>
        <body>
          <NextIntlClientProvider>
            <header className="flex items-center justify-between border-b border-gray-200 p-4">
              <Link href={`/${locale}`} className="text-lg font-semibold">
                Novapatch
              </Link>
              <div className="flex items-center gap-4">
                <SignedIn>
                  <Link
                    href={`/${locale}/cuenta`}
                    className="text-sm text-gray-700 hover:underline"
                  >
                    {t("mi_cuenta")}
                  </Link>
                  <UserButton />
                </SignedIn>
                <SignedOut>
                  <SignInButton mode="modal">
                    <button className="rounded bg-black px-3 py-1.5 text-sm font-medium text-white">
                      {t("iniciar_sesion")}
                    </button>
                  </SignInButton>
                </SignedOut>
              </div>
            </header>
            {children}
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 3.8: Update `apps/web/src/app/[locale]/page.tsx` to use translations**

Replace with:

```tsx
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return (
    <main className="min-h-screen p-12">
      <h1 className="text-4xl font-bold">{t("title")}</h1>
      <p className="mt-4 text-gray-600">{t("subtitle")}</p>
      <Link
        href={`/${locale}/cuenta`}
        className="mt-8 inline-block rounded bg-black px-4 py-2 text-sm font-medium text-white"
      >
        {t("cta_cuenta")}
      </Link>
    </main>
  );
}
```

- [ ] **Step 3.9: Update `apps/web/src/middleware.ts` to compose Clerk with next-intl**

Replace with:

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const isProtectedRoute = createRouteMatcher(["/(.*/)?cuenta(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
  return intlMiddleware(req);
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

- [ ] **Step 3.10: Typecheck**

```bash
pnpm --filter @novapatch/web typecheck
```

Expected: clean.

- [ ] **Step 3.11: Smoke-test locale routing**

```bash
echo "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_placeholder" > apps/web/.env.local
pnpm --filter @novapatch/web dev &
DEV_PID=$!
sleep 5
echo "--- GET / (expect 307 redirect) ---"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
echo "--- GET /mx (expect 200 + home) ---"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/mx
curl -s http://localhost:3000/mx | grep -q "Parches vitamínicos" && echo "OK: home renders Spanish" || echo "FAIL: missing Spanish text"
kill $DEV_PID 2>/dev/null || true
wait $DEV_PID 2>/dev/null || true
rm apps/web/.env.local
```

Expected: `/` → redirect; `/mx` → 200 with "Parches vitamínicos" in the HTML.

- [ ] **Step 3.12: Commit**

```bash
git add apps/web
git commit -m "feat(web): next-intl i18n with [locale] segment — mx/Spanish"
```

---

## Task 4: shadcn/ui bootstrap

**Files:**
- Create: `apps/web/components.json`
- Create: `apps/web/src/lib/utils.ts`
- Create: `apps/web/src/components/ui/button.tsx`
- Create: `apps/web/src/components/ui/card.tsx`
- Modify: `apps/web/package.json` — add `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`, `tw-animate-css`
- Modify: `apps/web/src/app/globals.css` — add shadcn v4 CSS tokens

- [ ] **Step 4.1: Add shadcn runtime deps**

In `apps/web/package.json`, add under `dependencies`:

```
"class-variance-authority": "^0.7.1",
"clsx": "^2.1.1",
"lucide-react": "^0.474.0",
"tailwind-merge": "^2.6.0",
"tw-animate-css": "^1.2.0"
```

Under `devDependencies`, keep the existing Tailwind entries. Run:

```bash
pnpm install
```

- [ ] **Step 4.2: Create `apps/web/components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 4.3: Create `apps/web/src/lib/utils.ts`**

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4.4: Replace `apps/web/src/app/globals.css` with the shadcn v4 token set**

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
}

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
    font-family: system-ui, -apple-system, sans-serif;
  }
}
```

- [ ] **Step 4.5: Create `apps/web/src/components/ui/button.tsx`**

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

> This requires `@radix-ui/react-slot`. Add it in the next step.

- [ ] **Step 4.6: Add `@radix-ui/react-slot` dep**

In `apps/web/package.json` under `dependencies`, add `"@radix-ui/react-slot": "^1.1.0"`. Then:

```bash
pnpm install
```

- [ ] **Step 4.7: Create `apps/web/src/components/ui/card.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
```

- [ ] **Step 4.8: Typecheck**

```bash
pnpm --filter @novapatch/web typecheck
```

Expected: clean.

- [ ] **Step 4.9: Smoke-test — verify shadcn Card renders**

Temporarily import Card in `apps/web/src/app/[locale]/page.tsx` to sanity-check rendering. Replace page.tsx with:

```tsx
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return (
    <main className="min-h-screen p-12">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{t("subtitle")}</p>
          <Link
            href={`/${locale}/cuenta`}
            className="mt-6 inline-block rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {t("cta_cuenta")}
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
```

Smoke test:

```bash
echo "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_placeholder" > apps/web/.env.local
pnpm --filter @novapatch/web dev &
DEV_PID=$!
sleep 5
curl -s http://localhost:3000/mx | grep -q 'data-slot="card"' && echo "OK: shadcn Card renders" || echo "FAIL"
kill $DEV_PID 2>/dev/null || true
wait $DEV_PID 2>/dev/null || true
rm apps/web/.env.local
```

Expected: `OK: shadcn Card renders`.

- [ ] **Step 4.10: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): shadcn/ui bootstrap — Button + Card + globals.css tokens"
```

---

## Task 5: API client + `/cuenta` page (TDD on the client)

**Files:**
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/test/lib/api.test.ts`
- Create: `apps/web/src/app/[locale]/cuenta/page.tsx`

- [ ] **Step 5.1: Write failing tests for the API client**

Create `apps/web/test/lib/api.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { fetchCustomer, ApiError } from "../../src/lib/api";

const ORIGINAL_FETCH = globalThis.fetch;

describe("fetchCustomer", () => {
  let calls: Array<{ url: string; init?: RequestInit }>;

  beforeEach(() => {
    calls = [];
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
  });

  function stubFetch(response: Response): void {
    globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      calls.push({ url, init });
      return response;
    }) as typeof fetch;
  }

  it("hits /me/customer on the configured API URL with a bearer token", async () => {
    stubFetch(
      new Response(
        JSON.stringify({
          id: "11111111-1111-1111-1111-111111111111",
          clerkUserId: "user_alice",
          email: "alice@example.com",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const customer = await fetchCustomer({ token: "tok_alice", apiUrl: "http://api.test" });
    expect(customer.email).toBe("alice@example.com");
    expect(customer.id).toBe("11111111-1111-1111-1111-111111111111");
    expect(calls[0]?.url).toBe("http://api.test/me/customer");
    const auth = (calls[0]?.init?.headers as Record<string, string>)?.Authorization;
    expect(auth).toBe("Bearer tok_alice");
  });

  it("throws ApiError with parsed envelope on 401", async () => {
    stubFetch(
      new Response(
        JSON.stringify({ error: { code: "auth_invalid", message: "token could not be verified" } }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );
    try {
      await fetchCustomer({ token: "tok_bad", apiUrl: "http://api.test" });
      throw new Error("expected fetchCustomer to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe("auth_invalid");
      expect((err as ApiError).status).toBe(401);
    }
  });

  it("throws ApiError with code=network when fetch rejects", async () => {
    globalThis.fetch = mock(async () => {
      throw new Error("econnrefused");
    }) as typeof fetch;
    try {
      await fetchCustomer({ token: "tok_alice", apiUrl: "http://api.test" });
      throw new Error("expected fetchCustomer to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe("network");
    }
  });
});
```

- [ ] **Step 5.2: Run; verify FAIL**

```bash
pnpm --filter @novapatch/web test
```

Expected: FAIL — `Cannot find module '../../src/lib/api'`.

- [ ] **Step 5.3: Create `apps/web/src/lib/api.ts`**

```typescript
export interface Customer {
  id: string;
  clerkUserId: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

interface BackendErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface FetchCustomerInput {
  token: string;
  apiUrl: string;
}

/**
 * Fetches the authenticated customer. Throws ApiError on any failure.
 *
 * Errors:
 *  - status 4xx/5xx → ApiError with the backend envelope code/message
 *  - network / JSON parse → ApiError with code="network"
 */
export async function fetchCustomer({ token, apiUrl }: FetchCustomerInput): Promise<Customer> {
  let res: Response;
  try {
    res = await fetch(`${apiUrl}/me/customer`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
  } catch (err) {
    throw new ApiError(
      "network",
      err instanceof Error ? err.message : "network error",
      0,
    );
  }

  if (!res.ok) {
    let body: BackendErrorBody | undefined;
    try {
      body = (await res.json()) as BackendErrorBody;
    } catch {
      body = undefined;
    }
    const code = body?.error?.code ?? "unknown";
    const message = body?.error?.message ?? `request failed: ${res.status}`;
    throw new ApiError(code, message, res.status, body?.error?.details);
  }

  return (await res.json()) as Customer;
}
```

- [ ] **Step 5.4: Run; verify PASS**

```bash
pnpm --filter @novapatch/web test
```

Expected: 3 tests pass.

- [ ] **Step 5.5: Create `apps/web/src/app/[locale]/cuenta/page.tsx`**

```tsx
import { auth } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { fetchCustomer, ApiError } from "@/lib/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export default async function CuentaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cuenta" });

  const { userId, getToken } = await auth();
  if (!userId) {
    // Middleware should have caught this; defensive redirect.
    redirect(`/${locale}`);
  }

  const token = await getToken();
  if (!token) {
    redirect(`/${locale}`);
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }

  let customer;
  let error: ApiError | undefined;
  try {
    customer = await fetchCustomer({ token, apiUrl });
  } catch (err) {
    if (err instanceof ApiError) {
      error = err;
    } else {
      throw err;
    }
  }

  return (
    <main className="min-h-screen p-12">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          {customer ? (
            <CardDescription>{customer.email}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-destructive text-sm">
              {error.code}: {error.message}
            </p>
          ) : customer ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t("email_label")}</dt>
              <dd>{customer.email}</dd>
              <dt className="text-muted-foreground">{t("member_since_label")}</dt>
              <dd>{new Date(customer.createdAt).toLocaleDateString(locale)}</dd>
            </dl>
          ) : (
            <p className="text-muted-foreground">{t("loading")}</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 5.6: Typecheck**

```bash
pnpm --filter @novapatch/web typecheck
```

Expected: clean.

- [ ] **Step 5.7: End-to-end smoke test**

Requires a real Clerk key + backend running. If you have them:

Create `apps/web/.env.local`:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_<REAL>
CLERK_SECRET_KEY=sk_test_<REAL>
NEXT_PUBLIC_API_URL=http://localhost:9000
```

Start the backend (separate shell):

```bash
docker compose up -d postgres
cd /Users/dlucca/Projects/novapatchv2/apps/api
CLERK_SECRET_KEY=sk_test_<REAL> DATABASE_URL="postgres://novapatch:novapatch@localhost:5433/novapatch" pnpm dev
```

Start the frontend:

```bash
pnpm --filter @novapatch/web dev
```

In a browser: visit `http://localhost:3000/mx`. Click "Iniciar sesión", sign in via Clerk, visit `/mx/cuenta`. Expect to see a Card with email + member-since date.

If you don't have a real Clerk key, SKIP this step — the unit tests in Step 5.4 already exercise the API client fully. Delete `apps/web/.env.local` when done.

- [ ] **Step 5.8: Commit**

```bash
git add apps/web/src/lib apps/web/test/lib apps/web/src/app/\[locale\]/cuenta
git commit -m "feat(web): API client + /cuenta page consuming GET /me/customer"
```

---

## Task 6: env + README + CI

**Files:**
- Modify: `.env.example` — add `NEXT_PUBLIC_API_URL`
- Modify: `README.md` — document frontend dev workflow
- Modify: `.github/workflows/ci.yml` — the existing `pnpm typecheck && pnpm test` will already pick up `@novapatch/web`; extend only if needed

- [ ] **Step 6.1: Update `.env.example`**

Read the file. Find the section:

```
# ----- Auth: Clerk -----
CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=
```

Replace with:

```
# ----- Auth: Clerk -----
CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=
# Next.js needs this exposed to the browser for the Clerk SDK.
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
```

Then find:

```
# ----- Database -----
```

Immediately BEFORE that line, insert:

```
# ----- Frontend (apps/web) -----
# Base URL the browser uses to reach the backend.
NEXT_PUBLIC_API_URL=http://localhost:9000

```

- [ ] **Step 6.2: Add `apps/web/.env` symlink convention to README**

Read `README.md`. Find the `## Setup` section. After the existing `ln -sf ../../.env apps/api/.env` line, add a sibling line for the web app:

```bash
# 3b. Same trick for the web app — Next.js also reads .env from its package dir.
ln -sf ../../.env apps/web/.env
```

- [ ] **Step 6.3: Add a "Running the frontend" subsection to `README.md`**

After the existing "Running the API" section, insert:

```markdown

## Running the frontend

```bash
pnpm --filter @novapatch/web dev
```

Next.js listens on `http://localhost:3000`. With the API running (port 9000) and a real Clerk key in `.env`, sign in via the header button and visit `/mx/cuenta` to see your customer row.
```

- [ ] **Step 6.4: Verify CI already runs frontend**

The existing CI workflow runs `pnpm typecheck` and `pnpm test` (workspace-recursive). With `@novapatch/web` added, these already pick up the new package. Verify by reading `.github/workflows/ci.yml` — the two `run:` steps should say `pnpm typecheck` and `pnpm test` with no package filter.

If they DO have a filter (they shouldn't per the earlier plan), remove it. Otherwise, no edit is needed.

- [ ] **Step 6.5: Run the full workspace locally to confirm green**

```bash
export PATH="$HOME/.bun/bin:$PATH"
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
```

Expected:
- `@novapatch/markets`: 10 pass
- `@novapatch/catalog`: 16 pass
- `@novapatch/api`: 53 pass
- `@novapatch/web`: 3 pass (fetchCustomer unit tests)
- **Total: 82**

Typecheck clean across all 4 packages.

If a CI-like clean install drifts the lockfile, adjust (`pnpm install` without `--frozen-lockfile`) and commit any updated lockfile in the final commit.

- [ ] **Step 6.6: Commit**

```bash
git add .env.example README.md
git commit -m "docs(web): document frontend dev workflow + NEXT_PUBLIC_API_URL"
```

If the lockfile changed, include it in this commit.

---

## Exit Criteria for This Plan

- `apps/web/` exists as a functional Next.js 15 app in the workspace.
- `pnpm --filter @novapatch/web dev` starts on port 3000.
- `/` redirects to `/mx`; `/mx` renders home with shadcn Card + Clerk header nav.
- `/mx/cuenta` is protected by Clerk middleware: unauth → sign-in modal; authed → customer data fetched from `GET /me/customer`.
- Frontend API client has typed `ApiError` envelope parsing + unit tests (happy / 401 / network).
- Total workspace test count: 82 (was 79).
- Typecheck clean across 4 packages.
- CI continues to pass (no changes to `ci.yml` needed beyond verifying it was already workspace-wide).
- 6 focused commits.

## Next Plan (not part of this one)

**Pricing engine + `POST /discounts/validate`** — purely backend. Additions to the `/me/*` surface and the `/tienda` / `/checkout` pages land in a subsequent frontend plan that consumes the pricing endpoints.
