# Static Pages 2a — Foundation + 7 Content Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 7 content-only pages (Nosotros, Garantía, FAQ, Suscripciones landing, Aviso de Privacidad, Términos, Términos Influencers, Influencers landing + Aplicar stub) under `/[locale]/*`, plus a shared Navbar + Footer and brand color tokens. All copy ported verbatim from `novafrontend` into `messages/es.json`.

**Architecture:** Brand tokens added to `globals.css`. A new Navbar (Client, has mobile Sheet) replaces the current minimal header in `[locale]/layout.tsx`. A Footer (Server) mounts below `{children}`. Each page is a Server Component reading `pages.<route>` from next-intl — no fetches, no auth, no interactivity. Legal + Influencers terms pages use an `{title, body}` array pattern iterated from i18n. FAQ uses shadcn `Accordion`.

**Tech Stack:** Next.js 15 + React 19 + Tailwind v4 + shadcn/ui + next-intl + Clerk (for the auth-aware Navbar bits). No backend changes.

**Spec:** [docs/superpowers/specs/2026-04-24-static-pages-2a-design.md](../specs/2026-04-24-static-pages-2a-design.md). Read before implementing.

---

## Context cheatsheet (read before Task 1)

- **Content source:** `/Users/dlucca/Projects/Novapatch/novafrontend/apps/storefront/app/[locale]/*/page.tsx`. The 11 page files there include the text we're porting. Read them directly (their content is considered stable for this plan — Diego's memory says that repo is the older one we're absorbing from).
- **i18n:** single locale `mx` → `apps/web/messages/es.json`. Everything new goes under `pages.<route>` and `site.{navbar,footer}`.
- **Existing globals.css:** has OKLCH tokens for background/foreground/primary/etc. + an `@theme inline` block. We append brand tokens to the `@theme inline` block so Tailwind v4 generates `bg-brand-*` / `text-brand-*` utilities.
- **Current layout** (`apps/web/src/app/[locale]/layout.tsx`) has a hand-rolled `<header>` with Clerk `<SignedIn>` / `<SignedOut>`. Task 2 extracts this into `<Navbar>` and adds `<Footer>`.
- **Shadcn install:** `cd apps/web && npx shadcn@latest add <component>`. New adds this plan: `sheet`, `accordion`.
- **`exactOptionalPropertyTypes` is on.** Conditional spread for optional props (`...(x ? { x } : {})`) instead of `x: undefined`.
- **ICU placeholders** (`{count}`, `{locale}`) only when a value is variable. Legal page sections use `\n\n`-separated body strings; the renderer splits on `\n\n` to produce `<p>` tags.
- **Stub routes:** `/tienda`, `/contacto`, `/reembolso`, `/influencers/aplicar` are linked from Navbar/Footer but not all exist in this plan. `tienda` is Plan 2b; `contacto` + `reembolso` are Plan 3. `influencers/aplicar` is a stub page created in Task 6.
- **next-intl context-by-param:** Server Components use `getTranslations({ locale, namespace })`; Client Components use `useTranslations(namespace)` inside the `NextIntlClientProvider` tree (already mounted in `[locale]/layout.tsx`).

---

## File Structure

**New (site-wide shared):**
- `apps/web/src/components/site/navbar.tsx` (Client)
- `apps/web/src/components/site/footer.tsx` (Server)

**New (pages):**
- `apps/web/src/app/[locale]/nosotros/page.tsx`
- `apps/web/src/app/[locale]/garantia/page.tsx`
- `apps/web/src/app/[locale]/faq/page.tsx`
- `apps/web/src/app/[locale]/suscripciones/page.tsx`
- `apps/web/src/app/[locale]/privacidad/page.tsx`
- `apps/web/src/app/[locale]/terminos/page.tsx`
- `apps/web/src/app/[locale]/terminos-influencers/page.tsx`
- `apps/web/src/app/[locale]/influencers/page.tsx`
- `apps/web/src/app/[locale]/influencers/aplicar/page.tsx`

**New (shadcn — via CLI):**
- `apps/web/src/components/ui/sheet.tsx`
- `apps/web/src/components/ui/accordion.tsx`

**Modify:**
- `apps/web/src/app/globals.css` — add 4 brand tokens
- `apps/web/src/app/[locale]/layout.tsx` — replace inline `<header>` with `<Navbar>`; append `<Footer>`
- `apps/web/messages/es.json` — add `site.navbar`, `site.footer`, and `pages.*` keys per page

---

## Task 1: Brand tokens + shadcn additions + i18n skeleton

**Files:**
- Modify: `apps/web/src/app/globals.css` — add brand tokens to `@theme inline`
- Install: shadcn `sheet` + `accordion`
- Modify: `apps/web/messages/es.json` — add `site.navbar` + `site.footer` keys

- [ ] **Step 1: Append brand tokens to `globals.css`**

Inside the existing `@theme inline { ... }` block (line 49–72), append **before the closing brace**:

```css
  /* Brand — ported from novafrontend */
  --color-brand-coral: oklch(0.65 0.23 30);
  --color-brand-deep-blue: oklch(0.42 0.10 250);
  --color-brand-sky: oklch(0.72 0.08 240);
  --color-brand-cream: oklch(0.97 0.01 90);
```

Do not touch the existing tokens. The block's closing `}` stays where it is.

- [ ] **Step 2: Install `sheet` + `accordion`**

```bash
cd apps/web && npx shadcn@latest add sheet accordion
```

If prompted, accept defaults. Expected: `apps/web/src/components/ui/sheet.tsx` + `apps/web/src/components/ui/accordion.tsx` appear.

If the CLI fails (network, version mismatch), report BLOCKED.

- [ ] **Step 3: Extend `es.json` with `site.navbar` + `site.footer`**

Open `apps/web/messages/es.json`. Keep the existing keys (`home`, `cuenta`, `nav`). Add a new top-level `site` sibling (between `nav` and the root closing brace — order doesn't matter but be consistent):

```json
  "site": {
    "navbar": {
      "tienda": "Tienda",
      "suscripciones": "Suscripciones",
      "nosotros": "Nosotros",
      "faq": "Preguntas frecuentes",
      "influencers": "Influencers",
      "open_menu": "Abrir menú",
      "close_menu": "Cerrar menú"
    },
    "footer": {
      "sections": {
        "navega": "Navega",
        "legales": "Legales",
        "novapatch": "Novapatch"
      },
      "links": {
        "tienda": "Tienda",
        "suscripciones": "Suscripciones",
        "faq": "Preguntas frecuentes",
        "contacto": "Contáctanos",
        "privacidad": "Aviso de Privacidad",
        "terminos": "Términos y Condiciones",
        "terminos_influencers": "Términos Influencers",
        "garantia": "Garantía",
        "reembolso": "Solicitar reembolso",
        "nosotros": "Nosotros",
        "influencers": "Influencers"
      },
      "contact_label": "contacto@novapatch.mx",
      "contact_email": "contacto@novapatch.mx",
      "tagline": "Hecho en México",
      "copyright": "© 2026 Novapatch"
    }
  }
```

- [ ] **Step 4: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: clean. Nothing imports the new keys yet, so failures here are a sign the shadcn install broke something.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/components/ui/sheet.tsx apps/web/src/components/ui/accordion.tsx apps/web/messages/es.json apps/web/package.json pnpm-lock.yaml apps/web/components.json
git commit -m "feat(web): brand tokens + sheet/accordion + site i18n skeleton"
```

(Drop `components.json` from the add list if it wasn't touched.)

---

## Task 2: Navbar + Footer + mount in layout

**Files:**
- Create: `apps/web/src/components/site/navbar.tsx`
- Create: `apps/web/src/components/site/footer.tsx`
- Modify: `apps/web/src/app/[locale]/layout.tsx`

- [ ] **Step 1: Build the Navbar**

`apps/web/src/components/site/navbar.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/nextjs";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface NavbarProps {
  locale: string;
}

interface NavItem {
  href: string;
  key: "tienda" | "suscripciones" | "nosotros" | "faq" | "influencers";
}

export function Navbar({ locale }: NavbarProps) {
  const tNav = useTranslations("site.navbar");
  const tAcct = useTranslations("nav");
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const base = `/${locale}`;

  const items: NavItem[] = [
    { href: `${base}/tienda`, key: "tienda" },
    { href: `${base}/suscripciones`, key: "suscripciones" },
    { href: `${base}/nosotros`, key: "nosotros" },
    { href: `${base}/faq`, key: "faq" },
    { href: `${base}/influencers`, key: "influencers" },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link
          href={base}
          className="text-lg font-black tracking-tight text-brand-deep-blue"
        >
          Novapatch
        </Link>

        {/* Desktop links */}
        <nav className="hidden items-center gap-6 md:flex">
          {items.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={
                isActive(item.href)
                  ? "text-sm font-semibold text-brand-coral underline underline-offset-4"
                  : "text-sm text-muted-foreground hover:text-foreground"
              }
            >
              {tNav(item.key)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <SignedIn>
            <Link
              href={`${base}/cuenta`}
              className="hidden text-sm text-muted-foreground hover:text-foreground md:inline"
            >
              {tAcct("mi_cuenta")}
            </Link>
            <UserButton />
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <Button size="sm">{tAcct("iniciar_sesion")}</Button>
            </SignInButton>
          </SignedOut>

          {/* Mobile hamburger */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={tNav("open_menu")}
                className="md:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>Novapatch</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-4 px-4">
                {items.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setSheetOpen(false)}
                    className={
                      isActive(item.href)
                        ? "text-base font-semibold text-brand-coral"
                        : "text-base text-foreground"
                    }
                  >
                    {tNav(item.key)}
                  </Link>
                ))}
                <SignedIn>
                  <Link
                    href={`${base}/cuenta`}
                    onClick={() => setSheetOpen(false)}
                    className="text-base text-muted-foreground"
                  >
                    {tAcct("mi_cuenta")}
                  </Link>
                </SignedIn>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Build the Footer**

`apps/web/src/components/site/footer.tsx`:

```tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";

interface FooterProps {
  locale: string;
}

export async function Footer({ locale }: FooterProps) {
  const t = await getTranslations({ locale, namespace: "site.footer" });
  const base = `/${locale}`;

  const columns = [
    {
      title: t("sections.navega"),
      links: [
        { href: `${base}/tienda`, label: t("links.tienda") },
        { href: `${base}/suscripciones`, label: t("links.suscripciones") },
        { href: `${base}/faq`, label: t("links.faq") },
        { href: `${base}/contacto`, label: t("links.contacto") },
      ],
    },
    {
      title: t("sections.legales"),
      links: [
        { href: `${base}/privacidad`, label: t("links.privacidad") },
        { href: `${base}/terminos`, label: t("links.terminos") },
        { href: `${base}/terminos-influencers`, label: t("links.terminos_influencers") },
        { href: `${base}/garantia`, label: t("links.garantia") },
        { href: `${base}/reembolso`, label: t("links.reembolso") },
      ],
    },
    {
      title: t("sections.novapatch"),
      links: [
        { href: `${base}/nosotros`, label: t("links.nosotros") },
        { href: `${base}/influencers`, label: t("links.influencers") },
      ],
    },
  ];

  return (
    <footer className="mt-16 border-t border-border bg-brand-cream">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-3">
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-brand-deep-blue">
                {col.title}
              </h3>
              <ul className="flex flex-col gap-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>
            {t("copyright")} · {t("tagline")}
          </p>
          <a
            href={`mailto:${t("contact_email")}`}
            className="hover:text-foreground"
          >
            {t("contact_label")}
          </a>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Mount Navbar + Footer in the locale layout**

Replace `apps/web/src/app/[locale]/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ClerkProvider } from "@clerk/nextjs";
import { routing } from "@/i18n/routing";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { Toaster } from "@/components/ui/sonner";
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

  return (
    <ClerkProvider>
      <html lang={locale}>
        <body>
          <NextIntlClientProvider>
            <Navbar locale={locale} />
            {children}
            <Footer locale={locale} />
            <Toaster position="bottom-right" richColors />
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

Note: `getTranslations({ locale, namespace: "nav" })` is no longer called here (was used for the inline header). The Navbar reads `nav` via `useTranslations` on the client; the Footer reads `site.footer` via `getTranslations`.

- [ ] **Step 4: Verify Navbar package deps**

`lucide-react` is needed for the `Menu` icon. Check if it's already in `apps/web/package.json`:

```bash
grep "lucide-react" apps/web/package.json
```

It likely is (shadcn installs it as a dep). If not:

```bash
cd apps/web && pnpm add lucide-react
```

- [ ] **Step 5: Typecheck + build + smoke**

```bash
cd apps/web && pnpm typecheck
```

Expected: clean.

```bash
cd apps/web && pnpm build
```

Expected: build completes. New content routes don't exist yet, but nav links to `/tienda`, `/contacto` etc. are just `<Link>`s — they don't cause build errors.

If running `pnpm dev` in another terminal: visit `/mx`, confirm the new Navbar renders with all 5 links + Clerk controls, and the Footer sits below with the three columns. On mobile width, hamburger opens the sheet. Links to `/mx/nosotros` etc. will 404 until Tasks 3–6 land.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/site apps/web/src/app/[locale]/layout.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): shared Navbar + Footer + brand-applied layout"
```

---

## Task 3: Nosotros + Garantía pages

**Files:**
- Create: `apps/web/src/app/[locale]/nosotros/page.tsx`
- Create: `apps/web/src/app/[locale]/garantia/page.tsx`
- Modify: `apps/web/messages/es.json` — add `pages.nosotros` and `pages.garantia`

Both pages follow the simple "hero + sections" pattern. Content is ported verbatim from the novafrontend files. This task also establishes the pattern the remaining page tasks reuse.

- [ ] **Step 1: Extract content for Nosotros**

Read `/Users/dlucca/Projects/Novapatch/novafrontend/apps/storefront/app/[locale]/nosotros/page.tsx`. Identify:

- Hero eyebrow (e.g. `"Nosotros"`), title (the `<motion.h1>`), body (the paragraph that follows).
- Each subsequent `<section>`'s heading + paragraph body. There are typically 2–4 sections (e.g. `mission`, `story`, `values`).

Add to `apps/web/messages/es.json` under a new top-level `pages.nosotros` key. Use the shape:

```json
  "pages": {
    "nosotros": {
      "hero": {
        "eyebrow": "Nosotros",
        "title": "<exact h1 from novafrontend>",
        "body": "<exact body paragraph>"
      },
      "sections": {
        "<slug>": { "title": "<section heading>", "body": "<section body>" },
        "<slug>": { "title": "...", "body": "..." }
      }
    }
  }
```

Pick slugs that mirror the novafrontend section meaning — `mission`, `story`, `values`, `team`, etc. Preserve the visual order via the order you list them in JSON.

If the novafrontend source has bullet lists or multi-paragraph bodies, join paragraphs with `\n\n`. The renderer below splits on that delimiter.

**Do not invent copy.** Port verbatim. If a novafrontend section has placeholder lorem, carry it forward unchanged — flag with `TODO:` at the end of the body string so Diego can find it in review.

If the existing `pages` key doesn't exist in `es.json` yet, add it as a top-level sibling to `site` / `nav` / etc.

- [ ] **Step 2: Extract content for Garantía**

Same process for `/Users/dlucca/Projects/Novapatch/novafrontend/apps/storefront/app/[locale]/garantia/page.tsx`. Expected sections: `coverage`, `exclusions`, `process` (or similar).

Add under `pages.garantia` with the same shape as `pages.nosotros`.

- [ ] **Step 3: Create the page renderer for Nosotros**

`apps/web/src/app/[locale]/nosotros/page.tsx`:

```tsx
import { getTranslations, getMessages } from "next-intl/server";

interface SectionEntry {
  title: string;
  body: string;
}

function paragraphs(body: string) {
  return body.split("\n\n").map((p, i) => (
    <p key={i} className="mb-4 text-base leading-relaxed text-muted-foreground last:mb-0">
      {p}
    </p>
  ));
}

export default async function NosotrosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.nosotros" });
  const messages = (await getMessages({ locale })) as {
    pages: { nosotros: { sections: Record<string, SectionEntry> } };
  };
  const sectionKeys = Object.keys(messages.pages.nosotros.sections);

  return (
    <main>
      <section className="bg-brand-cream px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-brand-coral">
            {t("hero.eyebrow")}
          </p>
          <h1 className="mb-6 text-4xl font-black tracking-tight text-brand-deep-blue md:text-5xl">
            {t("hero.title")}
          </h1>
          <div className="max-w-3xl">{paragraphs(t("hero.body"))}</div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="my-8 aspect-video rounded-lg bg-muted" aria-hidden="true" />
        {sectionKeys.map((slug) => (
          <section key={slug} className="mb-12 last:mb-0">
            <h2 className="mb-4 text-2xl font-bold text-brand-deep-blue">
              {t(`sections.${slug}.title`)}
            </h2>
            <div>{paragraphs(t(`sections.${slug}.body`))}</div>
          </section>
        ))}
      </div>
    </main>
  );
}
```

Note the `getMessages()` pattern: we need to enumerate section slugs at render time (the i18n file is the source of truth for which sections exist and in what order). `t()` alone doesn't support "list all keys in a namespace". `getMessages()` returns the raw object; we cast it to the shape we wrote.

- [ ] **Step 4: Create the page renderer for Garantía**

Identical shape to Nosotros. Save as `apps/web/src/app/[locale]/garantia/page.tsx` with the same file content as above, except:

- Replace every occurrence of `"pages.nosotros"` with `"pages.garantia"`.
- Replace `messages.pages.nosotros` with `messages.pages.garantia`.
- Remove the `<div className="my-8 aspect-video rounded-lg bg-muted" />` placeholder image block — Garantía reads as a policy doc, not a brand page.

Do NOT rename the helper `paragraphs` or the `SectionEntry` interface — they're local to the file, each page has its own copy. (Extracting a shared component is a follow-up; for 2 pages the duplication is lower friction than an abstraction.)

- [ ] **Step 5: Typecheck + smoke**

```bash
cd apps/web && pnpm typecheck
```

Expected: clean.

Run `pnpm dev` and visit `/mx/nosotros` + `/mx/garantia`. Each should render hero + sections. Copy should match novafrontend.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/[locale]/nosotros apps/web/src/app/[locale]/garantia apps/web/messages/es.json
git commit -m "feat(web): Nosotros + Garantía pages with content from novafrontend"
```

---

## Task 4: FAQ + Suscripciones landing

**Files:**
- Create: `apps/web/src/app/[locale]/faq/page.tsx`
- Create: `apps/web/src/app/[locale]/suscripciones/page.tsx`
- Modify: `apps/web/messages/es.json` — add `pages.faq` and `pages.suscripciones`

Both pages are more structural than Nosotros/Garantía: FAQ uses an accordion, Suscripciones has a 3-card feature grid.

- [ ] **Step 1: Extract FAQ content**

Read `/Users/dlucca/Projects/Novapatch/novafrontend/apps/storefront/app/[locale]/faq/page.tsx`. Identify:

- Hero eyebrow / title / subtitle.
- The array of questions + answers. The source may render them inline or via a component like `<FaqItem q="..." a="..." />`. Either way, flatten to a JSON array.

Add under `pages.faq`:

```json
    "faq": {
      "hero": {
        "eyebrow": "FAQ",
        "title": "<title from novafrontend>",
        "body": "<subtitle/body if any>"
      },
      "questions": [
        { "q": "<question 1>", "a": "<answer 1>" },
        { "q": "<question 2>", "a": "<answer 2>" }
      ]
    }
```

Preserve question order from novafrontend. If a novafrontend answer has paragraph breaks, join with `\n\n` — the renderer splits.

- [ ] **Step 2: Extract Suscripciones landing content**

Read `/Users/dlucca/Projects/Novapatch/novafrontend/apps/storefront/app/[locale]/suscripciones/page.tsx` (plus the sibling `SubscriptionsFAQ.tsx` only if its content belongs in this landing — judgment call: if it repeats the main FAQ or is targeted content, include as an extra section).

Structure the content as:

```json
    "suscripciones": {
      "hero": {
        "eyebrow": "Suscripciones",
        "title": "<hero title>",
        "body": "<hero body>"
      },
      "features": {
        "<slug_1>": { "title": "...", "body": "..." },
        "<slug_2>": { "title": "...", "body": "..." },
        "<slug_3>": { "title": "...", "body": "..." }
      },
      "cta": {
        "label": "<button label, e.g. 'Ver tienda'>",
        "href": "/tienda"
      }
    }
```

If novafrontend has more than 3 features, include all of them — the renderer iterates. If fewer, use what's there.

- [ ] **Step 3: Build the FAQ page**

`apps/web/src/app/[locale]/faq/page.tsx`:

```tsx
import { getTranslations, getMessages } from "next-intl/server";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface QA {
  q: string;
  a: string;
}

function paragraphs(body: string) {
  return body.split("\n\n").map((p, i) => (
    <p key={i} className="mb-3 text-sm leading-relaxed text-muted-foreground last:mb-0">
      {p}
    </p>
  ));
}

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.faq" });
  const messages = (await getMessages({ locale })) as {
    pages: { faq: { questions: QA[] } };
  };
  const questions = messages.pages.faq.questions;

  return (
    <main>
      <section className="bg-brand-cream px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-brand-coral">
            {t("hero.eyebrow")}
          </p>
          <h1 className="mb-6 text-4xl font-black tracking-tight text-brand-deep-blue md:text-5xl">
            {t("hero.title")}
          </h1>
          <p className="max-w-3xl text-base text-muted-foreground md:text-lg">
            {t("hero.body")}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-6 py-16">
        <Accordion type="single" collapsible>
          {questions.map((qa, i) => (
            <AccordionItem key={i} value={`q-${i}`}>
              <AccordionTrigger className="text-left text-base font-medium text-brand-deep-blue">
                {qa.q}
              </AccordionTrigger>
              <AccordionContent>{paragraphs(qa.a)}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Build the Suscripciones landing page**

`apps/web/src/app/[locale]/suscripciones/page.tsx`:

```tsx
import Link from "next/link";
import { getTranslations, getMessages } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface FeatureEntry {
  title: string;
  body: string;
}

function paragraphs(body: string) {
  return body.split("\n\n").map((p, i) => (
    <p key={i} className="mb-3 text-sm leading-relaxed text-muted-foreground last:mb-0">
      {p}
    </p>
  ));
}

export default async function SuscripcionesLandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.suscripciones" });
  const messages = (await getMessages({ locale })) as {
    pages: { suscripciones: { features: Record<string, FeatureEntry> } };
  };
  const featureKeys = Object.keys(messages.pages.suscripciones.features);

  return (
    <main>
      <section className="bg-brand-cream px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-brand-coral">
            {t("hero.eyebrow")}
          </p>
          <h1 className="mb-6 text-4xl font-black tracking-tight text-brand-deep-blue md:text-5xl">
            {t("hero.title")}
          </h1>
          <div className="max-w-3xl">{paragraphs(t("hero.body"))}</div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {featureKeys.map((slug) => (
            <Card key={slug}>
              <CardHeader>
                <CardTitle className="text-lg text-brand-deep-blue">
                  {t(`features.${slug}.title`)}
                </CardTitle>
              </CardHeader>
              <CardContent>{paragraphs(t(`features.${slug}.body`))}</CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link href={`/${locale}${t("cta.href")}`}>
            <Button size="lg" className="bg-brand-coral hover:bg-brand-coral/90">
              {t("cta.label")}
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Typecheck + smoke**

```bash
cd apps/web && pnpm typecheck
```

Expected: clean.

`pnpm dev` and visit `/mx/faq` + `/mx/suscripciones`. FAQ accordion opens/closes. Suscripciones shows 3 cards and a CTA button that navigates to `/mx/tienda` (404 until Plan 2b).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/[locale]/faq apps/web/src/app/[locale]/suscripciones apps/web/messages/es.json
git commit -m "feat(web): FAQ + Suscripciones landing pages"
```

---

## Task 5: Privacidad + Términos + Términos Influencers

**Files:**
- Create: `apps/web/src/app/[locale]/privacidad/page.tsx`
- Create: `apps/web/src/app/[locale]/terminos/page.tsx`
- Create: `apps/web/src/app/[locale]/terminos-influencers/page.tsx`
- Modify: `apps/web/messages/es.json` — add `pages.privacidad`, `pages.terminos`, `pages.terminos_influencers`

Three long-form legal pages. Same renderer shape (`sections` as an **array** of `{title, body}` because legal docs are intrinsically ordered and numbered). Each page task is mechanical: port novafrontend text, build the page with the shared pattern.

- [ ] **Step 1: Extract Privacidad content**

Read `/Users/dlucca/Projects/Novapatch/novafrontend/apps/storefront/app/[locale]/privacidad/page.tsx`. Extract the hero fields + every top-level section.

Because legal pages commonly have 8–20 sections, use an **array** (not an object) to preserve order deterministically:

```json
    "privacidad": {
      "hero": {
        "eyebrow": "Aviso de Privacidad",
        "title": "<title>",
        "body": "<last-updated / short intro>"
      },
      "sections": [
        { "title": "1. Identidad del responsable", "body": "..." },
        { "title": "2. Datos que recabamos", "body": "..." }
      ]
    }
```

Preserve section numbering exactly as novafrontend has it (don't re-number). For long bodies, join paragraphs with `\n\n`.

- [ ] **Step 2: Extract Términos content**

Same process for `/Users/dlucca/Projects/Novapatch/novafrontend/apps/storefront/app/[locale]/terminos/page.tsx`. Store under `pages.terminos` with the same `hero` + `sections[]` shape.

- [ ] **Step 3: Extract Términos Influencers content**

Same process for `/Users/dlucca/Projects/Novapatch/novafrontend/apps/storefront/app/[locale]/terminos-influencers/page.tsx`. Store under `pages.terminos_influencers` (note: underscore in JSON key, hyphen in URL).

- [ ] **Step 4: Build the Privacidad page**

`apps/web/src/app/[locale]/privacidad/page.tsx`:

```tsx
import { getTranslations, getMessages } from "next-intl/server";

interface Section {
  title: string;
  body: string;
}

function paragraphs(body: string) {
  return body.split("\n\n").map((p, i) => (
    <p key={i} className="mb-4 text-sm leading-relaxed text-muted-foreground last:mb-0">
      {p}
    </p>
  ));
}

export default async function PrivacidadPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.privacidad" });
  const messages = (await getMessages({ locale })) as {
    pages: { privacidad: { sections: Section[] } };
  };
  const sections = messages.pages.privacidad.sections;

  return (
    <main>
      <section className="bg-brand-cream px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-coral">
            {t("hero.eyebrow")}
          </p>
          <h1 className="mb-4 text-3xl font-black tracking-tight text-brand-deep-blue md:text-4xl">
            {t("hero.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("hero.body")}</p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-6 py-12">
        {sections.map((s, i) => (
          <section key={i} className="mb-10 last:mb-0">
            <h2 className="mb-3 text-lg font-bold text-brand-deep-blue">{s.title}</h2>
            <div>{paragraphs(s.body)}</div>
          </section>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Build the Términos page**

`apps/web/src/app/[locale]/terminos/page.tsx`:

Same file as Privacidad but with `"pages.terminos"` in both `getTranslations` + `getMessages` type narrowing.

Replace `messages.pages.privacidad` with `messages.pages.terminos`.

- [ ] **Step 6: Build the Términos Influencers page**

`apps/web/src/app/[locale]/terminos-influencers/page.tsx`:

Same file as Privacidad but with `"pages.terminos_influencers"` in both `getTranslations` + `getMessages` type narrowing.

Replace `messages.pages.privacidad` with `messages.pages.terminos_influencers`.

- [ ] **Step 7: Typecheck + smoke**

```bash
cd apps/web && pnpm typecheck
```

Expected: clean.

`pnpm dev` and visit each of the 3 routes. Verify numbered sections render in order, hero + title appear, text reads cleanly.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/[locale]/privacidad apps/web/src/app/[locale]/terminos apps/web/src/app/[locale]/terminos-influencers apps/web/messages/es.json
git commit -m "feat(web): Privacidad + Términos + Términos Influencers pages"
```

---

## Task 6: Influencers landing + Aplicar stub

**Files:**
- Create: `apps/web/src/app/[locale]/influencers/page.tsx`
- Create: `apps/web/src/app/[locale]/influencers/aplicar/page.tsx`
- Modify: `apps/web/messages/es.json` — add `pages.influencers` and `pages.influencers_aplicar`

- [ ] **Step 1: Extract Influencers landing content**

Read `/Users/dlucca/Projects/Novapatch/novafrontend/apps/storefront/app/[locale]/influencers/page.tsx`. Expected sections: why collaborate, what we offer, how to apply. Extract each as a card.

Add under `pages.influencers`:

```json
    "influencers": {
      "hero": {
        "eyebrow": "Influencers",
        "title": "<hero title>",
        "body": "<hero body>"
      },
      "cards": {
        "por_que": { "title": "...", "body": "..." },
        "que_ofrecemos": { "title": "...", "body": "..." },
        "como_aplicar": { "title": "...", "body": "..." }
      },
      "cta": {
        "label": "Aplicar ahora",
        "href": "/influencers/aplicar"
      }
    }
```

If novafrontend has more or fewer than 3 cards, use what's there — the renderer iterates.

- [ ] **Step 2: Write content for the Aplicar stub**

This page has no novafrontend equivalent (novafrontend's Influencers form is full-featured; we're stubbing for Plan 3). Add under `pages.influencers_aplicar`:

```json
    "influencers_aplicar": {
      "hero": {
        "eyebrow": "Aplicar",
        "title": "Próximamente",
        "body": "Estamos ultimando los detalles del programa. Mientras tanto, escribinos a influencers@novapatch.mx y te contactamos apenas el formulario esté disponible."
      }
    }
```

- [ ] **Step 3: Build the Influencers landing page**

`apps/web/src/app/[locale]/influencers/page.tsx`:

```tsx
import Link from "next/link";
import { getTranslations, getMessages } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface CardEntry {
  title: string;
  body: string;
}

function paragraphs(body: string) {
  return body.split("\n\n").map((p, i) => (
    <p key={i} className="mb-3 text-sm leading-relaxed text-muted-foreground last:mb-0">
      {p}
    </p>
  ));
}

export default async function InfluencersLandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.influencers" });
  const messages = (await getMessages({ locale })) as {
    pages: { influencers: { cards: Record<string, CardEntry> } };
  };
  const cardKeys = Object.keys(messages.pages.influencers.cards);

  return (
    <main>
      <section className="bg-brand-cream px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-brand-coral">
            {t("hero.eyebrow")}
          </p>
          <h1 className="mb-6 text-4xl font-black tracking-tight text-brand-deep-blue md:text-5xl">
            {t("hero.title")}
          </h1>
          <div className="max-w-3xl">{paragraphs(t("hero.body"))}</div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {cardKeys.map((slug) => (
            <Card key={slug}>
              <CardHeader>
                <CardTitle className="text-lg text-brand-deep-blue">
                  {t(`cards.${slug}.title`)}
                </CardTitle>
              </CardHeader>
              <CardContent>{paragraphs(t(`cards.${slug}.body`))}</CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link href={`/${locale}${t("cta.href")}`}>
            <Button size="lg" className="bg-brand-coral hover:bg-brand-coral/90">
              {t("cta.label")}
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Build the Aplicar stub page**

`apps/web/src/app/[locale]/influencers/aplicar/page.tsx`:

```tsx
import { getTranslations } from "next-intl/server";

export default async function InfluencersAplicarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.influencers_aplicar" });

  return (
    <main>
      <section className="bg-brand-cream px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-brand-coral">
            {t("hero.eyebrow")}
          </p>
          <h1 className="mb-6 text-4xl font-black tracking-tight text-brand-deep-blue md:text-5xl">
            {t("hero.title")}
          </h1>
          <p className="text-base text-muted-foreground md:text-lg">{t("hero.body")}</p>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Typecheck + build**

```bash
cd apps/web && pnpm typecheck && pnpm build
```

Expected: typecheck clean, build completes. All 9 new page routes are present now.

- [ ] **Step 6: Final smoke**

Run `pnpm dev`. Walk through each link in the Navbar and Footer:

- `/mx/nosotros` ✓
- `/mx/garantia` ✓
- `/mx/faq` ✓ (accordion works)
- `/mx/suscripciones` ✓ (CTA goes to `/tienda` — 404 OK for this plan)
- `/mx/privacidad` ✓
- `/mx/terminos` ✓
- `/mx/terminos-influencers` ✓
- `/mx/influencers` ✓ (CTA goes to `/mx/influencers/aplicar`)
- `/mx/influencers/aplicar` ✓ (stub "Próximamente")
- Navbar hamburger on mobile width opens sheet ✓
- Footer visible on every page ✓

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/[locale]/influencers apps/web/messages/es.json
git commit -m "feat(web): Influencers landing + Aplicar stub"
```

---

## Self-Review (controller already ran this)

- **Spec coverage:** brand tokens ✓ (Task 1), Navbar/Footer ✓ (Task 2), content extraction strategy ✓ (Tasks 3–6 each port verbatim from novafrontend), 7 content pages + 2 Influencers pages ✓, i18n under `pages.*` ✓, FAQ uses Accordion ✓, Suscripciones uses Card grid ✓, legal pages use section arrays ✓, stub routes in nav are documented ✓.
- **Placeholders:** none. Every step has a full code block or explicit command with expected output.
- **Type consistency:** the `paragraphs()` helper is intentionally duplicated per page (each page re-declares it). `SectionEntry` / `FeatureEntry` / `CardEntry` / `Section` interfaces are local to their pages and have consistent shape `{title, body}` (some use Record<string, _>, some arrays — explicitly documented per page).

---

## Follow-ups (intentionally out of scope)

- **Plan 2b — Tienda.** Product listing fetching `/catalog?market=mx`, grid of Cards.
- **Plan 3 — Contact + Refund + Influencer forms** with backend endpoints.
- Port real images from `novafrontend/public/` to `apps/web/public/` and replace the `bg-muted` placeholder in Nosotros.
- framer-motion scroll-in animations. Currently static.
- Extract the repeated `paragraphs()` helper to `apps/web/src/lib/text.tsx` when it's duplicated 3+ times (every page uses it — could already be consolidated, but the one-liner is cheap and the pages stay self-contained).
- Additional locales: `br`, `ar`, `cl`, `co` — next-intl already supports the pattern; copy needs translation.
- Cookie consent banner, structured data, sitemap.xml for SEO.
- Dark mode sweep across the new pages.
