# Tienda + PDP Design Spec

**Date:** 2026-04-27
**Plan:** #4b (per `docs/superpowers/ROADMAP.md`)
**Replaces:** `2026-04-25-tienda-and-checkout-design.md` (the checkout half is now Plan #6).
**Depends on:** Plan #4 (Home + cart store + drawer — done), Plan #7 (Plan Builder — done).

## Goal

Ship the public buying surface for one-time purchases:
- A `/[locale]/tienda` grid where any visitor can browse the 6 patches and add them to bag.
- A `/[locale]/productos/[slug]` editorial PDP per patch that explains what it is, who it's for, why it works, what's in it, and what it does/doesn't promise — sourced from the marketing knowledge base docs the user provided.

The PDP supports both a one-time add-to-bag and a "subscribe to this patch" flow with an inline frequency picker (30/60/90 days, canonical −20/−15/−10%).

## Non-goals

- Checkout / payment (Plan #6).
- Tienda category filters or search (only 6 SKUs; YAGNI).
- Side-by-side product comparator (post-launch backlog).
- Reviews / testimonials (no source content; out of scope).
- Internationalization beyond `mx` locale.
- A separate `/p/[slug]` short-link route — only `/productos/[slug]`.

## Brainstorm decisions (locked 2026-04-27)

| # | Question | Decision |
|---|---|---|
| Q1 | PDP scope | (A) Full editorial — 9 sections sourced from marketing docs |
| Q2 | Tienda differentiation | (A) Reuse cards + short hero; cards link to PDP, "Agregar" button still works inline |
| Q3 | PDP CTA strategy | (A) Two CTAs side by side: "Agregar" + "Suscribirme + inline freq picker" |

## Source content

The user provided 7 `.docx` files under `Bases de conocimiento Marketing/`:

- `Base de conocimiento general para Marketing Novapatch.docx` (cross-product framing)
- `Base de conocimiento Novapatch Energy.docx`
- `Base de conocimiento Novapatch Glow.docx`
- `Base de conocimiento Novapatch Shield.docx`
- `Base de conocimiento Novapatch Sleep.docx`
- `Base de conocimiento Novapatch Woman.docx`
- `Base de conocimiento Novapatch Zen.docx`

(There is also a Kids doc; not in scope — Novapatch Kids is not in `NOVA_PRODUCTS`.)

Each per-product doc has 14 numbered sections. The PDP draws specific sections:

| PDP section | Marketing doc section(s) |
|---|---|
| Hero subhead | §1 ("Qué es") |
| `<PdpProblem>` | §2 ("El problema real que resuelve") |
| `<PdpTarget>` | §4 ("Target") + §5 ("Qué NO es el target") |
| `<PdpMoments>` | §6 ("Momentos de uso") |
| `<PdpFormula>` | §7 ("El parche como formato ideal") + `NOVA_PRODUCTS[slug].ingredients` |
| `<PdpScience>` | §9 ("Ciencia comunicada de forma simple") |
| `<PdpPromises>` | §10 ("Qué promete y qué no promete") |
| `<PdpClaims>` | §14 ("Claims") |
| Tagline (sticky) | §13 ("Frase marco") |
| FAQ | curated 4 questions per product (extracted from common Q&A patterns across §1–§14) |

Content extraction is a manual editorial pass — the implementer reads each `.docx` (via `pandoc -t plain`) and writes a curated TS object per slug. We do NOT machine-translate or paraphrase by hand at runtime.

## Architecture

```
apps/web/src/
├── app/[locale]/
│   ├── tienda/
│   │   └── page.tsx                          # Server, hero + grid
│   └── productos/[slug]/
│       ├── page.tsx                          # Server, generateStaticParams + metadata
│       └── not-found.tsx                     # Server, 404 with link to /tienda
├── components/
│   ├── shop/
│   │   ├── tienda-hero.tsx                   # Server
│   │   ├── product-card-shop.tsx             # Client — Link wrapper around image+name; "Agregar +" inline
│   │   └── product-grid-shop.tsx             # Client — grid 1/2/3 cols
│   └── pdp/
│       ├── pdp-hero.tsx                      # Client (CTAs are client)
│       ├── pdp-cta-block.tsx                 # Client — both CTAs + inline freq picker
│       ├── pdp-target.tsx                    # Server
│       ├── pdp-problem.tsx                   # Server
│       ├── pdp-moments.tsx                   # Server (lucide icons inline)
│       ├── pdp-formula.tsx                   # Server
│       ├── pdp-science.tsx                   # Server (500-Daltons callout)
│       ├── pdp-promises.tsx                  # Server
│       ├── pdp-claims.tsx                    # Server
│       ├── pdp-faq.tsx                       # Client (Radix Accordion)
│       ├── pdp-sticky-cta.tsx                # Client — IntersectionObserver bottom bar
│       └── pdp-jsonld.tsx                    # Server — emits <script type="application/ld+json">
└── lib/
    └── products-content.ts                    # Curated content per slug
```

The home's existing `<ProductGrid />` and `<ProductCard />` (under `components/home/`) stay where they are. We are not refactoring the home in this plan; the shop card is a small variant that wraps the image + name in a Link. Code duplication is intentional and bounded (~40 lines).

## Routes

- `/[locale]/tienda` — Server component. Renders `<TiendaHero />` + `<ProductGridShop />`. No params, no dynamic data.
- `/[locale]/productos/[slug]` — Server component.
  - `generateStaticParams` → returns the 6 slugs (energy, sleep, glow, shield, zen, woman). Build emits 6 prerendered routes per locale.
  - `generateMetadata({ params })` → reads slug, returns `{ title, description, openGraph: { images: [/products/{Name}.webp] }, twitter }`.
  - Page body composes the 11 sections in order (Hero → Target → Problem → Moments → Formula → Science → Promises → Claims → FAQ → JSON-LD → StickyCta).
  - Unknown slug → `notFound()`.

## Data model

`apps/web/src/lib/products-content.ts`:

```ts
import type { ProductMeta } from "./products";

type Slug = ProductMeta["slug"];

export type FaqItem = { q: string; a: string };

export type ProductContent = {
  slug: Slug;
  hero: {
    eyebrow: string;     // e.g. "Defensas naturales"
    headline: string;    // e.g. "Tu rutina de cuidado empieza hoy"
    subhead: string;     // 1 sentence (Newsreader italic in product.color)
  };
  problem: {
    eyebrow: string;
    title: string;
    lead: string;
    bullets: string[];   // 3–4 bullets
  };
  target: {
    primary_eyebrow: string;
    primary: string[];   // 4–6 bullets ("Hecho para ti si...")
    not_for_eyebrow: string;
    not_for: string[];   // 3–4 bullets
  };
  moments: {
    eyebrow: string;
    title: string;
    items: { icon: LucideIconName; title: string; desc: string }[];  // 3 items
  };
  formula: {
    eyebrow: string;
    title: string;
    lead: string;
    /**
     * One row per active ingredient. `name` must match an entry in
     * NOVA_PRODUCTS[slug].ingredients (case-insensitive). Extra rows in
     * `ingredients` here that don't appear in the canonical list will surface
     * a build-time warning in tests but won't fail.
     */
    ingredients: { name: string; role: string }[];
  };
  science: {
    eyebrow: string;
    title: string;
    lead: string;       // 1–2 short paragraphs
  };
  promises: {
    promise_eyebrow: string;
    promise: string[];        // 4–6 ✓ items
    not_promise_eyebrow: string;
    not_promise: string[];    // 3–4 ✗ items
  };
  claims: {
    eyebrow: string;
    items: string[];    // 4–6 short claims (pill-sized, ≤ 6 words)
  };
  faq: FaqItem[];        // 4 items
  tagline: string;       // 1-line marco from §13, used in sticky CTA hover state
};

type LucideIconName =
  | "Sun"
  | "Moon"
  | "Sparkles"
  | "Shield"
  | "Heart"
  | "Coffee"
  | "Sunrise"
  | "Wind"
  | "Leaf";

export const PRODUCTS_CONTENT: Record<Slug, ProductContent> = { /* … */ };

export function getProductContent(slug: string): ProductContent | undefined {
  return (PRODUCTS_CONTENT as Record<string, ProductContent>)[slug];
}
```

The icon list is closed: only 9 icons, all from lucide-react. Adding a new one means editing the type.

## PDP layout

Mobile-first. Sections separated by `py-20` and alternating background (`bg-cream`, `bg-[var(--color-blush)]`) for visual rhythm.

### `<PdpHero>`

- `<section>` with `linear-gradient(160deg, ${product.ink} 0%, var(--color-navy) 75%)`. Same gradient idiom as the home Hero. Min-height `min-h-[80svh]` (not full svh — leave room for the rest of the page to peek).
- Two-column on desktop: copy left, patch image right.
- Copy block:
  - Pill (eyebrow): `bg-white/10 border border-white/20 text-white/85 uppercase tracking-wider`.
  - `<h1 className="font-outfit font-black text-white" style={{ fontSize: "clamp(40px, 9vw, 72px)" }}>` — `headline`.
  - `<p className="font-newsreader italic font-normal" style={{ color: product.color }}>` — `subhead`.
  - `<PdpCtaBlock>` below.
- Image side: `<Image priority fill src={product.image} alt={product.name}>` with `drop-shadow(0 30px 60px rgba(0,0,0,0.4))` and a halo (`pulseHaloPdp` keyframe, 4s).
- Keyframe name `pulseHaloPdp` to avoid colliding with home's `pulseHaloB`.

### `<PdpCtaBlock>`

State: `mode: "once" | "subscribe"`, `freq: 30 | 60 | 90`. Default `"once"`.

```
┌─────────────────────────┐  ┌──────────────────────────┐
│ Agregar · $750 MXN  →   │  │ Suscribirme desde $600/m │
│ (coral, primary)        │  │ (white outline)           │
└─────────────────────────┘  └──────────────────────────┘
```

When `mode === "subscribe"`, the second button "expands" inline by transitioning `max-height: 0 → 240px` on a sibling div containing:

- Eyebrow "¿Cada cuánto te llega?"
- 3 chips for 30/60/90 days, same idiom as Plan Builder card. Selected chip is `bg-white text-navy`; others `bg-white/10`.
- Final CTA: "Suscribirme · cada 30d −20%" (coral, with the freq + discount inlined).

Click on "Suscribirme" once a freq is selected → `addItem(p, perBox, { interval_days: freq, discount_percentage })` + `openDrawer()`.

Click on "Agregar" → `addItem(p, RETAIL_PRICE)` + `openDrawer()`.

`perBox = round(RETAIL_PRICE * (1 - SUB_DISCOUNTS[freq]))` — same helper from `lib/plan-pricing.ts`. Reuse, don't duplicate.

The subscribe-mode toggle is independent of the cart drawer state. After adding, the CTA block resets to `"once"` so the user sees a clean state if they go back.

### `<PdpTarget>`

```
"Hecho para ti si…"        | "No es para ti si…"
✓ Bullet 1                  | × Bullet 1
✓ Bullet 2                  | × Bullet 2
…                           | …
```

Two-column on desktop, stacked on mobile. Background `bg-cream`. Bullets are `text-navy/70`. Checkmarks: coral disc; X: navy/15 disc. Use the same disc styling as `<Comparison>` in the home (already shipped).

### `<PdpProblem>`

Centered single-column. `bg-[var(--color-blush)]`. Eyebrow + large headline (Outfit 900) + lead paragraph + bullet list (`space-y-3`, each bullet has a coral ▸ marker).

### `<PdpMoments>`

Background `bg-cream`. Eyebrow + title. Three cards in a row (`grid-cols-1 md:grid-cols-3 gap-6`). Each card:

- Lucide icon at top, color `var(--color-coral)`, size 28.
- Title (Outfit 900, 18px).
- 1-line desc (text-navy/70).
- Card style: `bg-white rounded-3xl p-6 shadow-sm`.

### `<PdpFormula>` (id="formula")

`bg-[var(--color-blush)]`. Two-column desktop:

- Left: eyebrow + title + lead.
- Right: ingredient list. Each row: ingredient name (Outfit 900, 18px) + role (text-navy/70, 14px). Separator `border-b border-navy/10`.

Below: a small reusable callout "< 500 Daltons · pasa por la piel" linking to `#ciencia` on PDP. The callout copy comes from the general marketing doc.

### `<PdpScience>` (id="ciencia")

`bg-[var(--color-navy)] text-white`. Centered, max-w 720px. Eyebrow `text-coral` + headline + 1–2 short paragraphs `text-white/80`. No diagram (the home's Absorption already has it; PDP doesn't duplicate).

### `<PdpPromises>`

`bg-cream`. Two-column. Left: "Te promete" (✓ coral list). Right: "No te promete" (× navy/30 list). Same disc styling as Target.

### `<PdpClaims>` (id="claims")

`bg-[var(--color-blush)]`. Eyebrow + title. Pills wrap (`flex flex-wrap gap-2`). Each claim: `bg-white border border-navy/10 rounded-full px-4 py-2 text-sm text-navy`. Max 6 claims.

### `<PdpFaq>` (id="faq")

`bg-cream`. Eyebrow "Preguntas frecuentes". Radix Accordion or shadcn `Accordion` (already in the project). 4 items per product. Each `<AccordionItem>`:

- Trigger: question (Outfit 700, text-navy, with a chevron rotating on open).
- Content: answer (text-navy/70, prose).

### `<PdpStickyCta>`

Visible only on mobile (`md:hidden`) and only after the hero CTA leaves the viewport (`IntersectionObserver` on the hero's `<PdpCtaBlock>`).

Fixed bottom bar:

- Left: thumb image (40×40) + "Glow · $750" small.
- Right: pill "Agregar →" coral.

Click adds at retail price (the simplest action; if the user wants to subscribe they scroll back up).

Bar enters with `translateY(100% → 0)` over 250ms when the IO fires.

### `<PdpJsonLd>`

Server component. Emits:

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Novapatch Glow",
  "description": "<hero.subhead>",
  "image": "https://novapatch.com/products/Glow.webp",
  "brand": { "@type": "Brand", "name": "Novapatch" },
  "offers": {
    "@type": "Offer",
    "url": "https://novapatch.com/mx/productos/glow",
    "priceCurrency": "MXN",
    "price": 750,
    "availability": "https://schema.org/InStock"
  }
}
```

The host (`novapatch.com`) is read from `process.env.NEXT_PUBLIC_SITE_URL` with a fallback to `https://novapatch.com`. Config exposed as `lib/site.ts`.

## Tienda layout

### `<TiendaHero>`

`bg-cream py-16`. Centered max-w 720px:
- Eyebrow "La tienda" (text-coral, uppercase tracking-wider).
- `<h1>` "Seis parches, **un bienestar para cada día**" (Outfit 900, "un bienestar para cada día" in Newsreader italic coral).
- Lead 1 sentence.

### `<ProductGridShop>`

Same visual as `<ProductGrid>` from home but each card:
- Wraps image + name in a `<Link href="/${locale}/productos/${slug}">`.
- "Agregar +" button still works inline; `e.stopPropagation()` + `e.preventDefault()` in the handler so the Link doesn't fire.

Grid: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`. Canonical product order.

## Navbar update

`<Navbar>` adds a "Tienda" link in both desktop and mobile menus. Visible on every page (not just home).

- Desktop home variant (transparent): the link sits next to existing anchors `Los parches / La ciencia / Comparativa`. Add "Tienda" before them so the order is `Tienda · Los parches · La ciencia · Comparativa`.
- Default (non-home) variant: only "Tienda" appears (the home anchors are already hidden off-home).

i18n key: `components.navbar.links.tienda` = `"Tienda"`.

## Cart store

No changes. PDP CTAs reuse the existing `addItem(p, price, subscription?)` signature (extended in Plan #7).

## Cart drawer

No changes. The subscription badge already renders from Plan #7.

## SEO + metadata

- `app/sitemap.ts` (Server): emits `/`, `/${locale}`, `/${locale}/tienda`, `/${locale}/suscripciones`, and `/${locale}/productos/${slug}` for each of the 6 slugs. `lastModified: new Date()`. `priority` 1.0 for home, 0.8 for /tienda + /suscripciones, 0.7 for PDPs.
- `app/robots.ts` (Server): default allow all, sitemap URL = `${baseUrl}/sitemap.xml`. (Skip if file already exists; otherwise create.)
- `generateMetadata` per PDP populates `title` ("Novapatch Glow · Bienestar desde adentro"), `description` (= `hero.subhead`), `openGraph.images` (= `/products/{Name}.webp`), `twitter.card: "summary_large_image"`.

## Testing

### Unit
- `lib/products-content.ts` exports complete content for all 6 slugs. Test: every slug has all required fields populated (no empty arrays, no empty strings on required props). Test asserts ingredients listed in `formula.ingredients` are a superset of `NOVA_PRODUCTS[slug].ingredients` (warns if extra, fails if missing).
- `getProductContent("not-a-slug")` returns `undefined`.
- `lib/site.ts`: `getSiteUrl()` returns env var when set, else fallback.

### Component (bun:test, smoke pattern)
- One smoke test per pdp/* component asserting `typeof <Component> === "function"`.
- `<PdpCtaBlock>` test: simulate `mode = "subscribe"`, set `freq = 30`, assert that `addItem` would be called with the right `subscription` payload (call the underlying handler directly).

### E2E (Playwright)
Add `apps/web/e2e/tienda-pdp.spec.ts`:

```
1. goto /mx/tienda
2. expect(getByText("La tienda")).toBeVisible()
3. expect(getByTestId("pcard-energy")).toBeVisible()
4. click pcard-energy image (the Link)
5. expect(URL).toBe("/mx/productos/energy")
6. expect(getByRole("heading", level: 1)).toBeVisible()
7. click "Agregar · $750"
8. expect drawer with Energy item
9. close drawer; click "Suscribirme desde…"
10. click "30d" chip
11. click final "Suscribirme · cada 30d −20%"
12. expect drawer with subscription item showing "Cada 30 días · −20%"
```

Reuse `NEXT_PUBLIC_API_URL` stub already in `playwright.config.ts`.

## Performance

- All 6 PDPs prerender at build (SSG via `generateStaticParams`).
- Hero patch image uses `priority` flag. Other images (no other images on PDP) use lazy by default.
- No client-side data fetching anywhere.
- LCP target < 2.5s on mid-range mobile.

## Accessibility

- Hero headline is `<h1>`; section titles are `<h2>`; cards inside sections use `<h3>`.
- Decorative halos / gradients have `aria-hidden`.
- FAQ accordion uses Radix (which handles aria-expanded/aria-controls correctly).
- "Agregar" / "Suscribirme" buttons have visible labels with the price → no `aria-label` overrides needed.
- Product images have `alt={product.name}` (sufficient — the surrounding markup explains the context).
- Color contrast: white text on navy gradient passes AA at `text-white` over `var(--color-navy)`. Italic Newsreader subhead uses `product.color` over the dark gradient — verify per product (some pastels may need a darker variant; if so, add `--color-product-{slug}-on-navy` tokens in a follow-up).
- Sticky mobile CTA does not trap focus and dismisses on hero re-entry via the same observer (transitions out smoothly).

## i18n

All copy lives in `apps/web/messages/es.json` under:

- `pages.tienda.hero.{eyebrow, title_a, title_b_italic, lead}`
- `pages.productos.cta.{add, subscribe_from, subscribe_freq_label, subscribe_confirm}`
- `pages.productos.section_titles.{target, problem, moments, formula, science, promises, claims, faq}` (eyebrow + title labels — the per-product copy lives in `products-content.ts`, not in i18n, because the tone is different per slug)
- `pages.productos.formula.daltons_callout`
- `pages.productos.faq.{empty}` (fallback)
- `components.navbar.links.tienda`

Per-product editorial copy stays in TS (`products-content.ts`) — it's not really translatable phrases, it's brand voice. If we add `pt-BR` later, the strategy is to add `products-content.pt.ts` per locale.

## Risks / open questions

- **Editorial workload:** writing curated copy for 6 products × 9 sections = ~54 content blocks. Mitigation: one implementation task is dedicated entirely to this content extraction; other tasks block on it but the work is bounded.
- **Marketing doc fidelity:** the `.docx` files are long-form prose. The implementer must extract & shorten faithfully without inventing claims. The plan's content-extraction task includes a verification step where we cross-check claims against `Base de conocimiento general para Marketing Novapatch.docx`.
- **Image fidelity per product:** all 6 images already exist under `/products/{Name}.webp` (shipped in Plan #4). No new assets needed.
- **No reviews / testimonials:** acknowledged. PDP is brand-led, not social-proof-led, by design.
- **No comparator:** acknowledged. If conversion data later asks for one, it's a separate plan.
- **Sticky CTA accessibility on iOS Safari:** `position: fixed` + `safe-area-inset-bottom` may need explicit padding; the Plan Builder bottom bar has the same issue and we'll mirror its approach.

## Out of scope (explicit)

- Checkout (Plan #6).
- Admin product CRUD (Plan #10).
- Stripe (Plan #5).
- Adding new SKUs beyond the 6 in `NOVA_PRODUCTS`.
- Localization beyond `mx`.

## Done means

- `bun test` and `bun run typecheck` green from `apps/web/`.
- `bun run test:e2e` passes including the new `tienda-pdp.spec.ts`.
- `/mx/tienda` and `/mx/productos/{glow,energy,sleep,shield,zen,woman}` all render with no console errors and content loaded for every slug.
- Cart drawer can hold both one-time and subscription items added from a PDP.
- Sitemap lists all PDPs. JSON-LD validates with Google's Rich Results test (manual smoke; not automated).
- ROADMAP.md Plan #4b row marked `**done** (2026-04-27)`.
