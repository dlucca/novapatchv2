# Static Pages 2a — Foundation + 7 Content Pages — Design Spec

**Status:** Approved — ready for implementation plan.
**Scope:** Port marketing and legal content from `novafrontend` (`/Users/dlucca/Projects/Novapatch/novafrontend/apps/storefront`) into `novapatchv2`'s web app: add brand tokens, a shared Navbar + Footer, and seven content-only pages. Tienda (Plan 2b) and form-backed pages (Plan 3) are out of scope.

---

## Goals

1. A visitor lands on `/mx` and can navigate to Nosotros, Suscripciones (landing), Garantía, Preguntas frecuentes, Aviso de Privacidad, Términos y Condiciones, Influencers from the Navbar or the Footer.
2. Each page has readable, on-brand layout built with shadcn + Tailwind v4 tokens. The four brand colors (coral / deep blue / sky / cream) are available as design tokens.
3. All user-facing copy lives in `apps/web/messages/es.json` under `pages.<route>` namespaces. No hardcoded strings in the JSX.
4. Content is ported verbatim from novafrontend — same words, same section structure. Visuals are simpler (no framer-motion, placeholder blocks where novafrontend had images).

## Non-Goals

- Tienda (product listing). Separate plan (2b).
- Contact form, Refund form, Influencer apply form. Separate plan (3).
- Real images. Placeholders (`<div className="bg-muted aspect-video" />`) stand in.
- Framer-motion animations. Everything is static CSS.
- Dark mode. Light theme only.
- E2E tests, visual regression, or unit tests of page components.
- Additional locales beyond `mx`. The `messages/<locale>.json` stays single-file for now.
- Footer newsletter signup, social icons, payment badges. Out of scope.

---

## Visual Foundation

### Brand tokens

Added to `apps/web/src/app/globals.css` inside the existing `@theme inline` block:

```css
@theme inline {
  /* ...existing OKLCH tokens... */

  /* Brand — ported from novafrontend */
  --color-brand-coral: oklch(0.65 0.23 30);
  --color-brand-deep-blue: oklch(0.42 0.10 250);
  --color-brand-sky: oklch(0.72 0.08 240);
  --color-brand-cream: oklch(0.97 0.01 90);
}
```

These map to the hex values used in novafrontend inline styles (`#E8503A`, `#005088`, `#5BA8D5`, `#FAF7F2`). Tailwind v4 exposes them as utility classes: `bg-brand-cream`, `text-brand-deep-blue`, etc.

### Navbar

File: `apps/web/src/components/site/navbar.tsx` (Client Component — needs `useState` for the mobile sheet).

Structure:

- **Logo** on the left: `Novapatch` text wordmark linking to `/{locale}`.
- **Desktop (md+):** horizontal `<Link>` list: Tienda · Suscripciones · Nosotros · FAQ · Influencers. On the right: Clerk's `<SignedIn><UserButton /></SignedIn>` + link to `/cuenta`, or `<SignedOut><SignInButton mode="modal"></SignedOut>` — identical to the current `[locale]/layout.tsx` header.
- **Mobile (<md):** logo + hamburger button. Clicking opens shadcn `Sheet` (from the `side="right"` variant) with the vertical link list + the Clerk controls.
- **Active tab highlight** via `usePathname()`: matches the route prefix under the locale (same pattern as `CuentaNav`).
- Replaces the existing `<header>` in `apps/web/src/app/[locale]/layout.tsx`.

Brand applied: logo in `text-brand-deep-blue`, active-link underline in `text-brand-coral`. Border-bottom `border-border` (shadcn default) to blend with other surfaces.

### Footer

File: `apps/web/src/components/site/footer.tsx` (Server Component — no interactivity).

Three columns stacked on mobile, side-by-side on md+:

- **Navega:** Tienda · Suscripciones · FAQ · Contacto (stub link — Plan 3)
- **Legales:** Aviso de Privacidad · Términos y Condiciones · Términos Influencers · Garantía · Solicitar reembolso (stub link)
- **Novapatch:** Nosotros · Influencers · mailto `contacto@novapatch.mx`

Bottom row: `© 2026 Novapatch · Hecho en México` (the year is hardcoded — not a dynamic concern for this plan).

Mounted inside `[locale]/layout.tsx` after `{children}` and before `<Toaster />`.

### shadcn components to add

`cd apps/web && npx shadcn@latest add sheet accordion`

Existing: button, card, badge, dialog, alert-dialog, select, skeleton, sonner.

---

## Pages

Nine new route segments under `apps/web/src/app/[locale]/`:

```
nosotros/page.tsx
garantia/page.tsx
faq/page.tsx
suscripciones/page.tsx         # landing — NOT /cuenta/suscripciones
privacidad/page.tsx
terminos/page.tsx
terminos-influencers/page.tsx
influencers/page.tsx           # landing with "Aplicar" CTA → /influencers/aplicar
influencers/aplicar/page.tsx   # stub: "Próximamente. Formulario disponible en breve."
```

All Server Components. None require auth. None fetch API data.

### Shared layout convention

Every content page follows this skeleton:

```tsx
export default async function <Name>Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.<route>" });

  return (
    <main>
      <section className="bg-brand-cream py-20 px-6">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-coral mb-4">
            {t("hero.eyebrow")}
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-brand-deep-blue mb-6">
            {t("hero.title")}
          </h1>
          <p className="text-base md:text-lg text-muted-foreground">
            {t("hero.body")}
          </p>
        </div>
      </section>

      {/* Per-page section structure follows */}
    </main>
  );
}
```

Body sections use `<section className="py-16 px-6"><div className="mx-auto max-w-3xl">...</div></section>` to keep line length readable.

### Per-page structure

**Nosotros** — hero + two content sections (`mission`, `story`). Placeholder image block between them (`<div className="bg-muted aspect-video rounded-lg my-12" />`).

**Garantía** — hero + 3 sections explaining coverage, exclusions, process. Each section `h2` + body paragraphs.

**FAQ** — hero + shadcn `Accordion` (`type="single"`, `collapsible`). Questions rendered from an array in `messages/es.json` at `pages.faq.questions`. Each `{ q, a }` becomes an `AccordionItem`. Typically 6–10 questions ported from novafrontend.

**Suscripciones (landing)** — hero + 3 feature cards (using shadcn `Card`) describing frequency discounts, pause anytime, free shipping. Closing CTA button linking to `/{locale}/tienda`.

**Privacidad** — long-form legal. Sections iterated from an array at `pages.privacidad.sections`, each `{ title, body }` where `body` is a string with paragraphs separated by `\n\n`. Rendered as `h2` + `<p>` stack.

**Términos** — same pattern as Privacidad (`pages.terminos.sections`).

**Términos Influencers** — same pattern (`pages.terminos_influencers.sections`). Route with hyphen `terminos-influencers/` but i18n key uses underscore for readability.

**Influencers (landing)** — hero + 3 info cards (por qué colaborar, qué ofrecemos, cómo aplicar) + CTA `<Button>` linking to `/{locale}/influencers/aplicar`.

**Influencers/aplicar (stub)** — hero + single paragraph "Próximamente. El formulario estará disponible en breve. Mientras tanto, escribinos a influencers@novapatch.mx". No form logic — Plan 3.

---

## Content Extraction Strategy

For each of the 7 real content pages + the 2 Influencers pages:

1. Read the corresponding `.tsx` in `novafrontend/apps/storefront/app/[locale]/<route>/page.tsx`.
2. Extract hero fields (`eyebrow`, `title`, `body`) + each subsequent `<section>`'s heading + body text verbatim.
3. Write them into `apps/web/messages/es.json` under `pages.<route>` with the structure documented above.
4. For **FAQ**, enumerate the questions array as the user sees them (including those that use external components in novafrontend — we flatten to `{q, a}`).
5. For **Privacidad / Términos**, treat each top-level heading as one `section`. Split long bodies into paragraph strings separated by `\n\n` (the renderer splits + wraps each in `<p>`).
6. Hardcoded inline styles in novafrontend (`style={{color: "#E8503A"}}`) translate to Tailwind utility classes with the new brand tokens.
7. Animation wrappers (`<motion.div {...fade(0.1)}>`) become plain `<div>`. No behavior change when the page loads; less visual polish.

No copy is invented. If novafrontend has a placeholder (like a TODO or lorem), the same placeholder is carried forward and flagged inline with a `TODO:` comment in `messages/es.json` — and `es.json` is gitignored? No — it's committed. The TODOs stay in commit history; Diego reviews.

---

## Navigation Wiring

### Navbar links

```
Tienda         → /{locale}/tienda              (404 until Plan 2b)
Suscripciones  → /{locale}/suscripciones
Nosotros       → /{locale}/nosotros
FAQ            → /{locale}/faq
Influencers    → /{locale}/influencers
```

Plus right-side Clerk controls and the `/{locale}/cuenta` link when signed in (preserving the current behavior).

### Footer links

Same routes as Navbar, plus:

```
Contacto       → /{locale}/contacto             (404 until Plan 3)
Reembolso      → /{locale}/reembolso            (404 until Plan 3)
Aviso          → /{locale}/privacidad
Términos       → /{locale}/terminos
Términos Infl. → /{locale}/terminos-influencers
Garantía       → /{locale}/garantia
```

Stubs (404 links) are acceptable for now. They render the Next.js default 404 shell; Diego can verify the links exist and see the copy in the Navbar/Footer. Plan 2b and Plan 3 fill the gaps.

---

## i18n Strategy

All new strings under `pages.*` namespace in `apps/web/messages/es.json`:

```json
{
  "home": { "..." },
  "cuenta": { "..." },
  "nav": { "..." },
  "site": {
    "navbar": {
      "tienda": "Tienda",
      "suscripciones": "Suscripciones",
      "nosotros": "Nosotros",
      "faq": "Preguntas frecuentes",
      "influencers": "Influencers"
    },
    "footer": {
      "sections": {
        "navega": "Navega",
        "legales": "Legales",
        "novapatch": "Novapatch"
      },
      "links": {
        "tienda": "Tienda",
        "contacto": "Contáctanos",
        "privacidad": "Aviso de Privacidad",
        "...": "..."
      },
      "tagline": "Hecho en México",
      "copyright": "© 2026 Novapatch"
    }
  },
  "pages": {
    "nosotros": { "hero": {...}, "sections": {...} },
    "garantia": { "hero": {...}, "sections": {...} },
    "faq": { "hero": {...}, "questions": [{...}] },
    "suscripciones": { "hero": {...}, "features": {...}, "cta": {...} },
    "privacidad": { "hero": {...}, "sections": [{...}] },
    "terminos": { "hero": {...}, "sections": [{...}] },
    "terminos_influencers": { "hero": {...}, "sections": [{...}] },
    "influencers": { "hero": {...}, "cards": {...}, "cta": {...} },
    "influencers_aplicar": { "hero": {...}, "body": "..." }
  }
}
```

**File size estimate:** `messages/es.json` goes from ~80 lines today to ~1000–1500 lines. That's acceptable for v1. If it becomes painful, next-intl supports per-namespace file splitting (`messages/es/pages.json` etc.) — we defer.

---

## Error Handling

- **404 for stub routes (tienda / contacto / reembolso):** Next.js default 404 shell. The Navbar/Footer link to them is intentional — they'll resolve when later plans land.
- **`error.tsx` on new routes:** not needed. These pages don't fetch anything that can fail. The root `app/error.tsx` covers any runtime exception.
- **Missing i18n key:** `useTranslations`/`getTranslations` throws if a key is missing. Typecheck won't catch it (next-intl doesn't type-check keys against the JSON by default). Detection = manual smoke during implementation. Acceptable for content pages.

---

## Testing

- **Typecheck:** `pnpm typecheck` must be clean.
- **Build:** `pnpm build` must complete.
- **Manual smoke:** `pnpm dev`, visit each route under `/mx/*`, verify:
  - Hero renders with eyebrow + title + body
  - Sections render
  - Navbar + Footer present and functional
  - FAQ accordion opens/closes
  - Mobile hamburger opens sheet

No unit tests. No Playwright. Same convention as prior frontend plans.

---

## Out-of-Scope Follow-ups

- **Plan 2b — Tienda** — product listing page fetching `/catalog?market=mx`, grid of `Card`s per product, eventual "Agregar al carrito" button.
- **Plan 3 — Forms** — Contáctanos, Solicitar reembolso, Influencer application, each with its own backend endpoint (needs Resend for contact email delivery).
- Real hero/section images in `apps/web/public/`.
- framer-motion for scroll-in animations.
- Dark mode coverage across the new pages.
- Additional locales: `br`, `ar`, `cl`, `co`.
- Newsletter signup footer row.
- Cookie consent banner.
- Schema.org structured data for SEO.
