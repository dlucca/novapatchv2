# Tienda + PDP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/[locale]/tienda` (grid) + `/[locale]/productos/[slug]` (editorial PDP, SSG, 6 prerendered slugs) with dual CTAs, JSON-LD, sitemap, and per-product editorial content sourced from the marketing knowledge base.

**Architecture:** Static site generation for the PDP. Per-product editorial content lives in `apps/web/src/lib/products-content.ts` curated from `Bases de conocimiento Marketing/*.docx`. PDP composed of one Client component (`PdpHero` + `PdpCtaBlock` for state) plus 7 Server section components. Tienda is a Server page wrapping a small Client grid that wraps each card in a `<Link>` to its PDP.

**Tech Stack:** Next.js 15 App Router · React 19 · Tailwind v4 · shadcn `Accordion` (Radix) · lucide-react · next-intl v4 · Zustand (existing cart) · bun:test · Playwright.

**Spec:** `docs/superpowers/specs/2026-04-27-tienda-pdp-design.md` — read top to bottom before starting.

**Critical project constraints:**

- `exactOptionalPropertyTypes: true` — pass optional props with conditional spread `{...(v !== undefined && { key: v })}`. Never `{ key: v ?? undefined }`.
- Tailwind v4 design tokens: `var(--color-navy)`, `var(--color-coral)`, `var(--color-teal)`, `var(--color-gold)`, `var(--color-sky)`, `var(--color-blush)`. Tailwind utilities (`bg-coral`, `text-navy`) work too.
- All Client components start with `"use client";` on line 1.
- Server components fetch i18n via `getTranslations({ locale, namespace })`; Client uses `useTranslations(namespace)`.
- Italic editorial spans use `font-newsreader italic font-normal`.
- Display headlines use `font-outfit font-black`.
- Tests use **bun:test** (NOT vitest). No `@testing-library/react`. Pattern: smoke-import + pure logic + cart store assertions. See `apps/web/test/components/cart/cart-drawer.test.ts`.
- Run from `apps/web/` with **bun**. No eslint (`bun run lint` will fail). `bun run typecheck` works.
- Locale prefix is `mx` (only locale). Messages in `apps/web/messages/es.json`.
- Per-product CSS keyframe names must be unique across the codebase. Existing keyframes: `pulseHaloB`, `floatPatchB`, `nc-descend-c`. New keyframes for PDP must use distinct names (e.g. `pulseHaloPdp`).
- Cart store API: `useCart.getState().addItem(p, price, subscription?)` — `subscription` shape `{ interval_days: 30|60|90, discount_percentage: 20|15|10 }`. `openDrawer()` opens the drawer. Already shipped in Plan #7.
- Pricing helpers in `apps/web/src/lib/plan-pricing.ts`: `perBox(freq)`, `monthlyOf(item)`, `discountPercent(freq)`. Reuse for the PDP CTA block.

**Test commands** (from `apps/web/`):

```bash
bun run typecheck      # tsc --noEmit
bun test ./test        # unit + smoke (existing 77 + new)
bun run test:e2e       # Playwright (chromium installed)
```

**Marketing source docs** (read each via `pandoc -t plain "/path/to/file.docx"`):

```
/Users/dlucca/Projects/Novapatch/Bases de conocimiento Marketing/
  Base de conocimiento general para Marketing Novapatch.docx
  Base de conocimiento Novapatch Energy.docx
  Base de conocimiento Novapatch Glow.docx
  Base de conocimiento Novapatch Shield.docx
  Base de conocimiento Novapatch Sleep.docx
  Base de conocimiento Novapatch Woman.docx
  Base de conocimiento Novapatch Zen.docx
```

(There is also a Kids doc — IGNORE it; not in `NOVA_PRODUCTS`.)

---

## Task 1: Setup — types, site URL helper, base i18n keys

**Files:**
- Create: `apps/web/src/lib/site.ts`
- Create: `apps/web/src/lib/products-content.ts` (types + empty record + getProductContent helper; content filled in Tasks 2–3)
- Create: `apps/web/test/unit/site.test.ts`
- Create: `apps/web/test/unit/products-content.test.ts`
- Modify: `apps/web/messages/es.json` — add `pages.tienda.*`, `pages.productos.*`, and `components.navbar.links.tienda`

### Steps

- [ ] **Step 1: Create `apps/web/src/lib/site.ts`**

```ts
const FALLBACK_SITE_URL = "https://novapatch.com";

export function getSiteUrl(): string {
  const env = process.env["NEXT_PUBLIC_SITE_URL"];
  return env && env.length > 0 ? env.replace(/\/$/, "") : FALLBACK_SITE_URL;
}
```

- [ ] **Step 2: Write `apps/web/test/unit/site.test.ts`**

```ts
import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { getSiteUrl } from "@/lib/site";

const KEY = "NEXT_PUBLIC_SITE_URL";
let original: string | undefined;

beforeEach(() => {
  original = process.env[KEY];
});
afterEach(() => {
  if (original === undefined) delete process.env[KEY];
  else process.env[KEY] = original;
});

describe("getSiteUrl", () => {
  it("returns fallback when env is unset", () => {
    delete process.env[KEY];
    expect(getSiteUrl()).toBe("https://novapatch.com");
  });

  it("returns env value when set", () => {
    process.env[KEY] = "https://staging.novapatch.com";
    expect(getSiteUrl()).toBe("https://staging.novapatch.com");
  });

  it("strips trailing slash", () => {
    process.env[KEY] = "https://staging.novapatch.com/";
    expect(getSiteUrl()).toBe("https://staging.novapatch.com");
  });
});
```

- [ ] **Step 3: Run test → PASS**

```bash
cd apps/web && bun test ./test/unit/site.test.ts
```

- [ ] **Step 4: Create `apps/web/src/lib/products-content.ts` (types only, content empty for now)**

```ts
import type { ProductMeta } from "@/lib/products";

type Slug = ProductMeta["slug"];

export type LucideIconName =
  | "Sun"
  | "Moon"
  | "Sparkles"
  | "Shield"
  | "Heart"
  | "Coffee"
  | "Sunrise"
  | "Wind"
  | "Leaf";

export type FaqItem = { q: string; a: string };

export type ProductContent = {
  slug: Slug;
  hero: { eyebrow: string; headline: string; subhead: string };
  problem: { eyebrow: string; title: string; lead: string; bullets: string[] };
  target: {
    primary_eyebrow: string;
    primary: string[];
    not_for_eyebrow: string;
    not_for: string[];
  };
  moments: {
    eyebrow: string;
    title: string;
    items: { icon: LucideIconName; title: string; desc: string }[];
  };
  formula: {
    eyebrow: string;
    title: string;
    lead: string;
    ingredients: { name: string; role: string }[];
  };
  science: { eyebrow: string; title: string; lead: string };
  promises: {
    promise_eyebrow: string;
    promise: string[];
    not_promise_eyebrow: string;
    not_promise: string[];
  };
  claims: { eyebrow: string; items: string[] };
  faq: FaqItem[];
  tagline: string;
};

// Content filled in Tasks 2 + 3 (curated from .docx marketing knowledge base)
export const PRODUCTS_CONTENT = {} as Record<Slug, ProductContent>;

export function getProductContent(slug: string): ProductContent | undefined {
  return (PRODUCTS_CONTENT as Record<string, ProductContent>)[slug];
}
```

- [ ] **Step 5: Write `apps/web/test/unit/products-content.test.ts`** (will exercise content completeness in Tasks 2/3; for now only checks the shape and unknown-slug behavior)

```ts
import { describe, expect, it } from "bun:test";
import { getProductContent, PRODUCTS_CONTENT } from "@/lib/products-content";

describe("products-content", () => {
  it("getProductContent returns undefined for unknown slug", () => {
    expect(getProductContent("not-a-slug")).toBeUndefined();
    expect(getProductContent("")).toBeUndefined();
  });

  it("PRODUCTS_CONTENT is a record (will be populated in Tasks 2/3)", () => {
    expect(typeof PRODUCTS_CONTENT).toBe("object");
  });
});
```

- [ ] **Step 6: Add base i18n keys to `apps/web/messages/es.json`**

Insert under `pages` (preserve existing siblings like `home`, `suscripciones`):

```json
"tienda": {
  "hero": {
    "eyebrow": "La tienda",
    "title_a": "Seis parches,",
    "title_b_italic": "un bienestar para cada día",
    "lead": "Constancia, no fricción. Activa los hábitos que tu cuerpo agradece todos los días."
  }
},
"productos": {
  "cta": {
    "add": "Agregar · ${price} MXN",
    "subscribe_from": "Suscribirme desde ${price}/mes",
    "subscribe_freq_label": "¿Cada cuánto te llega?",
    "subscribe_confirm": "Suscribirme · cada {days}d −{percent}%"
  },
  "section_titles": {
    "target_eyebrow": "Para quién",
    "target_title": "¿Es para ti?",
    "faq_eyebrow": "Preguntas frecuentes",
    "faq_title": "Lo que querías preguntar"
  },
  "formula": {
    "daltons_callout": "Pasa por la piel · < 500 Daltons",
    "ingredient_role_label": "función"
  },
  "sticky_cta": {
    "add": "Agregar →"
  },
  "not_found": {
    "title": "No encontramos ese parche",
    "lead": "El producto que buscas no existe o cambió de nombre.",
    "cta": "Volver a la tienda"
  }
}
```

Then under `components.navbar.links` add:

```json
"tienda": "Tienda"
```

- [ ] **Step 7: Run typecheck + tests**

```bash
cd apps/web && bun run typecheck && bun test ./test
```

Expected: PASS (existing 77 + 5 new). The `PRODUCTS_CONTENT` record being empty does NOT fail typecheck because we cast it through `as Record<Slug, ProductContent>`.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/site.ts apps/web/src/lib/products-content.ts apps/web/test/unit/site.test.ts apps/web/test/unit/products-content.test.ts apps/web/messages/es.json
git commit -m "feat(shop): scaffold products-content types, site URL helper, base i18n"
```

---

## Task 2: Curate editorial content — Energy, Sleep, Glow

**Files:**
- Modify: `apps/web/src/lib/products-content.ts` (add 3 entries to `PRODUCTS_CONTENT`)
- Modify: `apps/web/test/unit/products-content.test.ts` (add completeness assertions)

### Source materials (read each before writing)

```bash
pandoc -t plain "/Users/dlucca/Projects/Novapatch/Bases de conocimiento Marketing/Base de conocimiento general para Marketing Novapatch.docx"
pandoc -t plain "/Users/dlucca/Projects/Novapatch/Bases de conocimiento Marketing/Base de conocimiento Novapatch Energy.docx"
pandoc -t plain "/Users/dlucca/Projects/Novapatch/Bases de conocimiento Marketing/Base de conocimiento Novapatch Sleep.docx"
pandoc -t plain "/Users/dlucca/Projects/Novapatch/Bases de conocimiento Marketing/Base de conocimiento Novapatch Glow.docx"
```

### Steps

- [ ] **Step 1: Read all 4 .docx files (general + 3 product) end to end** before writing any content. The general doc establishes brand voice, "regla de los 500 Daltons", and what claims are/are not allowed. The product docs follow a 14-section pattern.

- [ ] **Step 2: For each of the 3 products, populate a `ProductContent` object**

Mapping from doc sections → fields:

- `hero.eyebrow` — short category label (e.g. "Energía celular sostenida"). Reuse `NOVA_PRODUCTS[slug].tagline` if it fits.
- `hero.headline` — 1 strong line (Outfit 900). 4–7 words. Pull from §1 or §13.
- `hero.subhead` — 1 sentence in product brand voice (Newsreader italic). Pull from §1 closing line.
- `problem.eyebrow` — 1–3 word eyebrow (e.g. "El reto real", "El problema").
- `problem.title` — distill §2 opening into 1 question or assertion (≤12 words).
- `problem.lead` — 1 paragraph (≤60 words) summarizing §2.
- `problem.bullets` — 3–4 short bullets of the failure modes from §2.
- `target.primary_eyebrow` — e.g. "Hecho para ti si…".
- `target.primary` — 4–6 bullets from §4.
- `target.not_for_eyebrow` — e.g. "No es para ti si…".
- `target.not_for` — 3–4 bullets from §5.
- `moments.eyebrow` — e.g. "Cuándo se usa".
- `moments.title` — 1-line label (e.g. "Cuando lo necesitas").
- `moments.items` — 3 items from §6. Pick a `LucideIconName` that fits each moment. Energy mornings → `Sunrise`. Sleep nights → `Moon`. Glow constancy → `Sparkles`.
- `formula.eyebrow` — e.g. "La fórmula".
- `formula.title` — 1 line about the patch format (§7).
- `formula.lead` — 1–2 sentences from §7 + §3 (500 Daltons).
- `formula.ingredients` — for each ingredient in `NOVA_PRODUCTS[slug].ingredients`, write a 4–8 word `role` (what it does in this patch). MUST include every canonical ingredient. Order matches the canonical list.
- `science.eyebrow` — e.g. "La ciencia".
- `science.title` — 1 line. Reuse the 500 Daltons framing if appropriate.
- `science.lead` — 1–2 short paragraphs from §9.
- `promises.promise_eyebrow` — e.g. "Te promete".
- `promises.promise` — 4–6 short ✓ items from §10 (the "promete" half).
- `promises.not_promise_eyebrow` — e.g. "No te promete".
- `promises.not_promise` — 3–4 short × items from §10 (the "no promete" half).
- `claims.eyebrow` — e.g. "Por qué Novapatch".
- `claims.items` — 4–6 pill-sized claims (≤6 words each) from §14. NEVER invent claims not in the source.
- `faq` — 4 question/answer pairs. Synthesize from common patterns across §1–§14. Each `q` is a real user question; each `a` is 1–3 sentences.
- `tagline` — pull §13 verbatim or distill to 1 short line.

- [ ] **Step 3: Verify ingredient coverage**

For each populated product, every name in `NOVA_PRODUCTS[slug].ingredients` MUST appear in `formula.ingredients`. Names match case-insensitively. The list may include extras (e.g. doc mentions a co-factor not in canonical) — that's fine, but flag if so.

- [ ] **Step 4: Add completeness tests to `apps/web/test/unit/products-content.test.ts`**

```ts
import { describe, expect, it } from "bun:test";
import { PRODUCTS_CONTENT } from "@/lib/products-content";
import { NOVA_PRODUCTS } from "@/lib/products";

const POPULATED: ReadonlyArray<keyof typeof PRODUCTS_CONTENT> = [
  "energy",
  "sleep",
  "glow",
];

describe("PRODUCTS_CONTENT (Task 2 batch: energy/sleep/glow)", () => {
  for (const slug of POPULATED) {
    describe(slug, () => {
      const c = PRODUCTS_CONTENT[slug];

      it("has all required fields populated", () => {
        expect(c).toBeDefined();
        expect(c.hero.headline.length).toBeGreaterThan(0);
        expect(c.hero.subhead.length).toBeGreaterThan(0);
        expect(c.problem.bullets.length).toBeGreaterThanOrEqual(3);
        expect(c.target.primary.length).toBeGreaterThanOrEqual(4);
        expect(c.target.not_for.length).toBeGreaterThanOrEqual(3);
        expect(c.moments.items.length).toBe(3);
        expect(c.promises.promise.length).toBeGreaterThanOrEqual(4);
        expect(c.promises.not_promise.length).toBeGreaterThanOrEqual(3);
        expect(c.claims.items.length).toBeGreaterThanOrEqual(4);
        expect(c.claims.items.length).toBeLessThanOrEqual(6);
        expect(c.faq.length).toBe(4);
        expect(c.tagline.length).toBeGreaterThan(0);
      });

      it("formula.ingredients covers every canonical ingredient", () => {
        const product = NOVA_PRODUCTS.find((p) => p.slug === slug)!;
        const have = new Set(
          c.formula.ingredients.map((i) => i.name.toLowerCase()),
        );
        for (const ing of product.ingredients) {
          expect(have.has(ing.toLowerCase())).toBe(true);
        }
      });
    });
  }
});
```

- [ ] **Step 5: Run tests + typecheck**

```bash
cd apps/web && bun run typecheck && bun test ./test/unit/products-content.test.ts
```

Expected: PASS for energy/sleep/glow. (Tests for shield/zen/woman not added yet; they come in Task 3.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/products-content.ts apps/web/test/unit/products-content.test.ts
git commit -m "feat(shop): add curated content for Energy, Sleep, Glow"
```

---

## Task 3: Curate editorial content — Shield, Zen, Woman

**Files:**
- Modify: `apps/web/src/lib/products-content.ts` (add 3 entries)
- Modify: `apps/web/test/unit/products-content.test.ts` (extend POPULATED to all 6)

### Source materials

```bash
pandoc -t plain "/Users/dlucca/Projects/Novapatch/Bases de conocimiento Marketing/Base de conocimiento Novapatch Shield.docx"
pandoc -t plain "/Users/dlucca/Projects/Novapatch/Bases de conocimiento Marketing/Base de conocimiento Novapatch Zen.docx"
pandoc -t plain "/Users/dlucca/Projects/Novapatch/Bases de conocimiento Marketing/Base de conocimiento Novapatch Woman.docx"
```

### Steps

- [ ] **Step 1: Read all 3 product docs end to end.**

- [ ] **Step 2: Populate the 3 remaining `ProductContent` entries** following the same mapping rules as Task 2.

Icon hints:
- Shield — `Shield` for the immunity moment, `Sun` for daily prevention, `Coffee`/`Heart` for routine.
- Zen — `Wind` or `Leaf` for calm; `Coffee` for stress moments; `Heart` for grounding.
- Woman — `Moon` for cycle moments, `Sparkles` for hormonal balance, `Heart` for self-care.

- [ ] **Step 3: Update completeness tests**

In `apps/web/test/unit/products-content.test.ts`, replace the `POPULATED` constant:

```ts
const POPULATED: ReadonlyArray<keyof typeof PRODUCTS_CONTENT> = [
  "energy",
  "sleep",
  "glow",
  "shield",
  "zen",
  "woman",
];
```

Add a top-level assertion that every slug in `NOVA_PRODUCTS` has content:

```ts
import { NOVA_PRODUCTS } from "@/lib/products";

describe("PRODUCTS_CONTENT covers every NOVA_PRODUCT", () => {
  for (const p of NOVA_PRODUCTS) {
    it(`has content for ${p.slug}`, () => {
      expect(PRODUCTS_CONTENT[p.slug]).toBeDefined();
    });
  }
});
```

- [ ] **Step 4: Run tests + typecheck**

```bash
cd apps/web && bun run typecheck && bun test ./test/unit/products-content.test.ts
```

Expected: PASS (all 6 slugs).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/products-content.ts apps/web/test/unit/products-content.test.ts
git commit -m "feat(shop): add curated content for Shield, Zen, Woman"
```

---

## Task 4: PdpCtaBlock (Client) with TDD

**Files:**
- Create: `apps/web/src/components/pdp/pdp-cta-block.tsx`
- Create: `apps/web/test/components/pdp/pdp-cta-block.test.ts`

### Steps

- [ ] **Step 1: Confirm `discountPercent` exists in `apps/web/src/lib/plan-pricing.ts`**

```bash
grep -n "discountPercent\|export function" apps/web/src/lib/plan-pricing.ts
```

If `discountPercent` is missing, add this function next to `perBox` (do NOT modify other functions):

```ts
export function discountPercent(freq: 30 | 60 | 90): 20 | 15 | 10 {
  return freq === 30 ? 20 : freq === 60 ? 15 : 10;
}
```

- [ ] **Step 2: Write failing test `apps/web/test/components/pdp/pdp-cta-block.test.ts`**

```ts
import { describe, expect, it, beforeEach } from "bun:test";
import { PdpCtaBlock } from "@/components/pdp/pdp-cta-block";
import { useCart } from "@/components/cart/cart-store";
import { NOVA_PRODUCTS, RETAIL_PRICE } from "@/lib/products";

beforeEach(() => {
  useCart.setState({ items: [], drawerOpen: false, hydrated: true });
});

describe("PdpCtaBlock", () => {
  it("exports a function", () => {
    expect(typeof PdpCtaBlock).toBe("function");
  });

  it("addItem flow at retail price for one-time mode", () => {
    // Drive store directly — equivalent to clicking Agregar.
    const p = NOVA_PRODUCTS.find((x) => x.slug === "energy")!;
    useCart.getState().addItem(p, RETAIL_PRICE);
    useCart.getState().openDrawer();
    expect(useCart.getState().items[0]).toMatchObject({
      slug: "energy",
      price: 750,
      qty: 1,
    });
    expect(useCart.getState().items[0]?.subscription).toBeUndefined();
    expect(useCart.getState().drawerOpen).toBe(true);
  });

  it("subscribe flow at 30 days lands subscription metadata + correct price", () => {
    const p = NOVA_PRODUCTS.find((x) => x.slug === "glow")!;
    const perBox = Math.round(RETAIL_PRICE * 0.8); // 30d → −20%
    useCart
      .getState()
      .addItem(p, perBox, { interval_days: 30, discount_percentage: 20 });
    expect(useCart.getState().items[0]).toMatchObject({
      slug: "glow",
      price: perBox,
      qty: 1,
      subscription: { interval_days: 30, discount_percentage: 20 },
    });
  });
});
```

- [ ] **Step 3: Run test → FAIL (component does not exist yet)**

- [ ] **Step 4: Implement `apps/web/src/components/pdp/pdp-cta-block.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import type { ProductMeta } from "@/lib/products";
import { RETAIL_PRICE } from "@/lib/products";
import { useCart } from "@/components/cart/cart-store";
import { perBox, discountPercent } from "@/lib/plan-pricing";

type Freq = 30 | 60 | 90;

interface PdpCtaBlockProps {
  product: ProductMeta;
}

export function PdpCtaBlock({ product }: PdpCtaBlockProps) {
  const t = useTranslations("pages.productos.cta");
  const [mode, setMode] = useState<"once" | "subscribe">("once");
  const [freq, setFreq] = useState<Freq>(30);

  const onceClick = () => {
    useCart.getState().addItem(product, RETAIL_PRICE);
    useCart.getState().openDrawer();
    setMode("once");
  };

  const subscribeClick = () => {
    if (mode !== "subscribe") {
      setMode("subscribe");
      return;
    }
    const price = perBox(freq);
    const discount = discountPercent(freq);
    useCart.getState().addItem(product, price, {
      interval_days: freq,
      discount_percentage: discount,
    });
    useCart.getState().openDrawer();
    setMode("once");
  };

  const minPerMonth = perBox(30); // cheapest per-box for the eyebrow CTA copy

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onceClick}
          className="inline-flex items-center gap-2 rounded-full bg-coral px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-coral/90"
        >
          {t("add", { price: RETAIL_PRICE })}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={subscribeClick}
          aria-pressed={mode === "subscribe"}
          className={
            mode === "subscribe"
              ? "inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-6 py-3 text-base font-semibold text-white"
              : "inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3 text-base font-semibold text-white hover:bg-white/10"
          }
        >
          {mode === "subscribe"
            ? t("subscribe_confirm", { days: freq, percent: discountPercent(freq) })
            : t("subscribe_from", { price: minPerMonth })}
        </button>
      </div>

      {/* Inline freq picker */}
      <div
        style={{
          maxHeight: mode === "subscribe" ? 200 : 0,
          overflow: "hidden",
          transition: "max-height 320ms cubic-bezier(0.22,1,0.36,1)",
        }}
        aria-hidden={mode !== "subscribe"}
      >
        <div className="mt-5 rounded-2xl border border-white/15 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
            {t("subscribe_freq_label")}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {([30, 60, 90] as const).map((f) => {
              const sel = f === freq;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFreq(f)}
                  aria-pressed={sel}
                  className={
                    sel
                      ? "rounded-xl bg-white px-3 py-3 text-center text-sm font-semibold text-navy"
                      : "rounded-xl bg-white/10 px-3 py-3 text-center text-sm font-semibold text-white/85 hover:bg-white/20"
                  }
                >
                  <div className="font-outfit text-base font-black">
                    {f}
                    <span className="text-xs font-semibold opacity-70">d</span>
                  </div>
                  <div
                    className="text-xs font-bold"
                    style={{ color: product.color }}
                  >
                    −{discountPercent(f)}%
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run test → PASS**

```bash
cd apps/web && bun test ./test/components/pdp/pdp-cta-block.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/plan-pricing.ts apps/web/src/components/pdp/pdp-cta-block.tsx apps/web/test/components/pdp/pdp-cta-block.test.ts
git commit -m "feat(pdp): add PdpCtaBlock with one-time + subscribe inline freq picker"
```

(`plan-pricing.ts` is included only if Step 1 had to add `discountPercent`. Otherwise drop it from `git add`.)

---

## Task 5: PdpHero (Client)

**Files:**
- Create: `apps/web/src/components/pdp/pdp-hero.tsx`
- Create: `apps/web/test/components/pdp/pdp-hero.test.ts`

### Steps

- [ ] **Step 1: Write smoke test `apps/web/test/components/pdp/pdp-hero.test.ts`**

```ts
import { describe, expect, it } from "bun:test";
import { PdpHero } from "@/components/pdp/pdp-hero";

describe("PdpHero", () => {
  it("exports a function", () => {
    expect(typeof PdpHero).toBe("function");
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `apps/web/src/components/pdp/pdp-hero.tsx`**

```tsx
"use client";

import Image from "next/image";
import type { ProductMeta } from "@/lib/products";
import type { ProductContent } from "@/lib/products-content";
import { PdpCtaBlock } from "@/components/pdp/pdp-cta-block";

interface PdpHeroProps {
  product: ProductMeta;
  content: ProductContent["hero"];
}

export function PdpHero({ product, content }: PdpHeroProps) {
  const bg = `linear-gradient(160deg, ${product.ink} 0%, var(--color-navy) 75%)`;
  const halo = `radial-gradient(900px 600px at 75% 40%, ${product.color}55, transparent 60%)`;

  return (
    <section
      style={{ background: bg }}
      className="relative min-h-[80svh] overflow-hidden pt-24 pb-16"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: halo }}
      />

      <div className="relative z-10 mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="inline-block rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-wider text-white/85">
            {content.eyebrow}
          </span>
          <h1
            className="mt-5 font-outfit font-black leading-[0.98] text-white"
            style={{ fontSize: "clamp(40px, 9vw, 72px)" }}
          >
            {content.headline}
          </h1>
          <p
            className="mt-4 font-newsreader italic font-normal text-2xl lg:text-3xl"
            style={{ color: product.color }}
          >
            {content.subhead}
          </p>
          <PdpCtaBlock product={product} />
        </div>

        <div className="relative h-[420px] lg:h-[560px]">
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${product.color}66, transparent 65%)`,
              animation: "pulseHaloPdp 4s ease-in-out infinite",
            }}
          />
          <Image
            src={product.image}
            alt={product.name}
            priority
            fill
            sizes="(min-width:1024px) 50vw, 100vw"
            className="object-contain"
            style={{ filter: "drop-shadow(0 30px 60px rgba(0,0,0,0.4))" }}
          />
        </div>
      </div>

      <style jsx>{`
        @keyframes pulseHaloPdp {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.06);
            opacity: 0.8;
          }
        }
      `}</style>
    </section>
  );
}
```

- [ ] **Step 4: Run test + typecheck → PASS**

```bash
cd apps/web && bun run typecheck && bun test ./test/components/pdp/pdp-hero.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/pdp/pdp-hero.tsx apps/web/test/components/pdp/pdp-hero.test.ts
git commit -m "feat(pdp): add PdpHero with gradient and halo"
```

---

## Task 6: PDP Server sections — Target, Problem, Moments

**Files:**
- Create: `apps/web/src/components/pdp/pdp-target.tsx`
- Create: `apps/web/src/components/pdp/pdp-problem.tsx`
- Create: `apps/web/src/components/pdp/pdp-moments.tsx`
- Create: `apps/web/test/components/pdp/pdp-server-sections.test.ts`

### Steps

- [ ] **Step 1: Implement `apps/web/src/components/pdp/pdp-target.tsx`**

```tsx
import { getTranslations } from "next-intl/server";
import type { ProductContent } from "@/lib/products-content";

interface PdpTargetProps {
  locale: string;
  content: ProductContent["target"];
}

export async function PdpTarget({ locale, content }: PdpTargetProps) {
  const t = await getTranslations({
    locale,
    namespace: "pages.productos.section_titles",
  });

  return (
    <section className="bg-cream py-20">
      <div className="mx-auto max-w-5xl px-4">
        <span className="text-xs uppercase tracking-wider text-coral">
          {t("target_eyebrow")}
        </span>
        <h2 className="mt-3 font-outfit text-3xl font-black leading-tight text-navy lg:text-4xl">
          {t("target_title")}
        </h2>

        <div className="mt-10 grid gap-10 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-navy/60">
              {content.primary_eyebrow}
            </p>
            <ul className="mt-4 space-y-3">
              {content.primary.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-1 inline-grid h-5 w-5 shrink-0 place-items-center rounded-full bg-coral text-white text-[11px] font-bold"
                  >
                    ✓
                  </span>
                  <span className="text-sm text-navy/80">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-navy/60">
              {content.not_for_eyebrow}
            </p>
            <ul className="mt-4 space-y-3">
              {content.not_for.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-1 inline-grid h-5 w-5 shrink-0 place-items-center rounded-full bg-navy/15 text-navy/50 text-[11px] font-bold"
                  >
                    ✕
                  </span>
                  <span className="text-sm text-navy/70">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Implement `apps/web/src/components/pdp/pdp-problem.tsx`**

```tsx
import type { ProductContent } from "@/lib/products-content";

interface PdpProblemProps {
  content: ProductContent["problem"];
}

export function PdpProblem({ content }: PdpProblemProps) {
  return (
    <section className="bg-[var(--color-blush)] py-20">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <span className="text-xs uppercase tracking-wider text-coral">
          {content.eyebrow}
        </span>
        <h2 className="mt-3 font-outfit text-3xl font-black leading-tight text-navy lg:text-5xl">
          {content.title}
        </h2>
        <p className="mt-5 text-base text-navy/75">{content.lead}</p>
        <ul className="mt-10 grid gap-3 text-left md:grid-cols-2">
          {content.bullets.map((b) => (
            <li
              key={b}
              className="flex items-start gap-3 rounded-2xl bg-white/60 p-4"
            >
              <span aria-hidden className="text-coral font-bold">▸</span>
              <span className="text-sm text-navy/80">{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Implement `apps/web/src/components/pdp/pdp-moments.tsx`**

```tsx
import type { ProductContent, LucideIconName } from "@/lib/products-content";
import {
  Sun,
  Moon,
  Sparkles,
  Shield,
  Heart,
  Coffee,
  Sunrise,
  Wind,
  Leaf,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<LucideIconName, LucideIcon> = {
  Sun,
  Moon,
  Sparkles,
  Shield,
  Heart,
  Coffee,
  Sunrise,
  Wind,
  Leaf,
};

interface PdpMomentsProps {
  content: ProductContent["moments"];
}

export function PdpMoments({ content }: PdpMomentsProps) {
  return (
    <section className="bg-cream py-20">
      <div className="mx-auto max-w-6xl px-4">
        <span className="text-xs uppercase tracking-wider text-coral">
          {content.eyebrow}
        </span>
        <h2 className="mt-3 font-outfit text-3xl font-black leading-tight text-navy lg:text-4xl">
          {content.title}
        </h2>
        <ul className="mt-10 grid gap-6 md:grid-cols-3">
          {content.items.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <li
                key={item.title}
                className="rounded-3xl bg-white p-6 shadow-sm"
              >
                <Icon
                  aria-hidden
                  className="h-7 w-7 text-coral"
                  strokeWidth={1.8}
                />
                <p className="mt-4 font-outfit text-lg font-black text-navy">
                  {item.title}
                </p>
                <p className="mt-2 text-sm text-navy/70">{item.desc}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Smoke tests `apps/web/test/components/pdp/pdp-server-sections.test.ts`**

```ts
import { describe, expect, it } from "bun:test";
import { PdpTarget } from "@/components/pdp/pdp-target";
import { PdpProblem } from "@/components/pdp/pdp-problem";
import { PdpMoments } from "@/components/pdp/pdp-moments";

describe("PDP server sections", () => {
  it("PdpTarget exports a function", () => {
    expect(typeof PdpTarget).toBe("function");
  });
  it("PdpProblem exports a function", () => {
    expect(typeof PdpProblem).toBe("function");
  });
  it("PdpMoments exports a function", () => {
    expect(typeof PdpMoments).toBe("function");
  });
});
```

- [ ] **Step 5: Run typecheck + tests → PASS**

```bash
cd apps/web && bun run typecheck && bun test ./test/components/pdp/pdp-server-sections.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/pdp/pdp-target.tsx apps/web/src/components/pdp/pdp-problem.tsx apps/web/src/components/pdp/pdp-moments.tsx apps/web/test/components/pdp/pdp-server-sections.test.ts
git commit -m "feat(pdp): add Target, Problem, Moments server sections"
```

---

## Task 7: PDP Server sections — Formula, Science, Promises, Claims

**Files:**
- Create: `apps/web/src/components/pdp/pdp-formula.tsx`
- Create: `apps/web/src/components/pdp/pdp-science.tsx`
- Create: `apps/web/src/components/pdp/pdp-promises.tsx`
- Create: `apps/web/src/components/pdp/pdp-claims.tsx`
- Modify: `apps/web/test/components/pdp/pdp-server-sections.test.ts`

### Steps

- [ ] **Step 1: Implement `apps/web/src/components/pdp/pdp-formula.tsx`**

```tsx
import { getTranslations } from "next-intl/server";
import type { ProductContent } from "@/lib/products-content";

interface PdpFormulaProps {
  locale: string;
  content: ProductContent["formula"];
}

export async function PdpFormula({ locale, content }: PdpFormulaProps) {
  const t = await getTranslations({
    locale,
    namespace: "pages.productos.formula",
  });

  return (
    <section id="formula" className="bg-[var(--color-blush)] py-20">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <div>
          <span className="text-xs uppercase tracking-wider text-coral">
            {content.eyebrow}
          </span>
          <h2 className="mt-3 font-outfit text-3xl font-black leading-tight text-navy lg:text-4xl">
            {content.title}
          </h2>
          <p className="mt-5 text-base text-navy/75">{content.lead}</p>
          <a
            href="#ciencia"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-navy shadow-sm hover:bg-coral hover:text-white"
          >
            {t("daltons_callout")}
          </a>
        </div>

        <ul className="space-y-3 lg:mt-10">
          {content.ingredients.map((ing) => (
            <li
              key={ing.name}
              className="flex flex-col gap-1 rounded-2xl bg-white/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
            >
              <span className="font-outfit text-lg font-black text-navy">
                {ing.name}
              </span>
              <span className="text-sm text-navy/70">{ing.role}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Implement `apps/web/src/components/pdp/pdp-science.tsx`**

```tsx
import type { ProductContent } from "@/lib/products-content";

interface PdpScienceProps {
  content: ProductContent["science"];
}

export function PdpScience({ content }: PdpScienceProps) {
  return (
    <section
      id="ciencia"
      className="bg-[var(--color-navy)] py-20 text-white"
    >
      <div className="mx-auto max-w-3xl px-4 text-center">
        <span className="text-xs uppercase tracking-wider text-coral">
          {content.eyebrow}
        </span>
        <h2 className="mt-3 font-outfit text-3xl font-black leading-tight text-white lg:text-4xl">
          {content.title}
        </h2>
        <p className="mt-5 text-base text-white/80">{content.lead}</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Implement `apps/web/src/components/pdp/pdp-promises.tsx`**

```tsx
import type { ProductContent } from "@/lib/products-content";

interface PdpPromisesProps {
  content: ProductContent["promises"];
}

export function PdpPromises({ content }: PdpPromisesProps) {
  return (
    <section className="bg-cream py-20">
      <div className="mx-auto grid max-w-5xl gap-10 px-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-coral">
            {content.promise_eyebrow}
          </p>
          <ul className="mt-4 space-y-3">
            {content.promise.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-1 inline-grid h-5 w-5 shrink-0 place-items-center rounded-full bg-coral text-white text-[11px] font-bold"
                >
                  ✓
                </span>
                <span className="text-sm text-navy/85">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-navy/55">
            {content.not_promise_eyebrow}
          </p>
          <ul className="mt-4 space-y-3">
            {content.not_promise.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-1 inline-grid h-5 w-5 shrink-0 place-items-center rounded-full bg-navy/15 text-navy/50 text-[11px] font-bold"
                >
                  ✕
                </span>
                <span className="text-sm text-navy/70">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Implement `apps/web/src/components/pdp/pdp-claims.tsx`**

```tsx
import type { ProductContent } from "@/lib/products-content";

interface PdpClaimsProps {
  content: ProductContent["claims"];
}

export function PdpClaims({ content }: PdpClaimsProps) {
  return (
    <section id="claims" className="bg-[var(--color-blush)] py-16">
      <div className="mx-auto max-w-5xl px-4 text-center">
        <span className="text-xs uppercase tracking-wider text-coral">
          {content.eyebrow}
        </span>
        <ul className="mt-6 flex flex-wrap justify-center gap-2">
          {content.items.map((claim) => (
            <li
              key={claim}
              className="rounded-full border border-navy/10 bg-white px-4 py-2 text-sm text-navy"
            >
              {claim}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Extend smoke tests** in `apps/web/test/components/pdp/pdp-server-sections.test.ts`

Add the imports at the top:

```ts
import { PdpFormula } from "@/components/pdp/pdp-formula";
import { PdpScience } from "@/components/pdp/pdp-science";
import { PdpPromises } from "@/components/pdp/pdp-promises";
import { PdpClaims } from "@/components/pdp/pdp-claims";
```

Add inside the existing `describe("PDP server sections", …)` block:

```ts
it("PdpFormula exports a function", () => {
  expect(typeof PdpFormula).toBe("function");
});
it("PdpScience exports a function", () => {
  expect(typeof PdpScience).toBe("function");
});
it("PdpPromises exports a function", () => {
  expect(typeof PdpPromises).toBe("function");
});
it("PdpClaims exports a function", () => {
  expect(typeof PdpClaims).toBe("function");
});
```

- [ ] **Step 6: Run typecheck + tests → PASS**

```bash
cd apps/web && bun run typecheck && bun test ./test/components/pdp/pdp-server-sections.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/pdp/pdp-formula.tsx apps/web/src/components/pdp/pdp-science.tsx apps/web/src/components/pdp/pdp-promises.tsx apps/web/src/components/pdp/pdp-claims.tsx apps/web/test/components/pdp/pdp-server-sections.test.ts
git commit -m "feat(pdp): add Formula, Science, Promises, Claims server sections"
```

---

## Task 8: PdpFaq (Client w/ Accordion)

**Files:**
- Create: `apps/web/src/components/pdp/pdp-faq.tsx`
- Create: `apps/web/test/components/pdp/pdp-faq.test.ts`

### Steps

- [ ] **Step 1: Confirm `apps/web/src/components/ui/accordion.tsx` exists** (it does — uses Radix). Read its export shape briefly:

```bash
grep -E "^export" apps/web/src/components/ui/accordion.tsx
```

Expect named exports: `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`.

- [ ] **Step 2: Write smoke test `apps/web/test/components/pdp/pdp-faq.test.ts`**

```ts
import { describe, expect, it } from "bun:test";
import { PdpFaq } from "@/components/pdp/pdp-faq";

describe("PdpFaq", () => {
  it("exports a function", () => {
    expect(typeof PdpFaq).toBe("function");
  });
});
```

- [ ] **Step 3: Implement `apps/web/src/components/pdp/pdp-faq.tsx`**

```tsx
"use client";

import { useTranslations } from "next-intl";
import type { ProductContent } from "@/lib/products-content";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

interface PdpFaqProps {
  faq: ProductContent["faq"];
}

export function PdpFaq({ faq }: PdpFaqProps) {
  const t = useTranslations("pages.productos.section_titles");

  return (
    <section id="faq" className="bg-cream py-20">
      <div className="mx-auto max-w-3xl px-4">
        <span className="text-xs uppercase tracking-wider text-coral">
          {t("faq_eyebrow")}
        </span>
        <h2 className="mt-3 font-outfit text-3xl font-black leading-tight text-navy lg:text-4xl">
          {t("faq_title")}
        </h2>
        <Accordion
          type="single"
          collapsible
          className="mt-8 divide-y divide-navy/10 rounded-3xl border border-navy/10 bg-white"
        >
          {faq.map((item, idx) => (
            <AccordionItem key={item.q} value={`faq-${idx}`} className="px-5">
              <AccordionTrigger className="text-left font-outfit text-base font-semibold text-navy">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-sm text-navy/75">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run typecheck + test → PASS**

```bash
cd apps/web && bun run typecheck && bun test ./test/components/pdp/pdp-faq.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/pdp/pdp-faq.tsx apps/web/test/components/pdp/pdp-faq.test.ts
git commit -m "feat(pdp): add PdpFaq with Radix Accordion"
```

---

## Task 9: PdpStickyCta (Client w/ IntersectionObserver)

**Files:**
- Create: `apps/web/src/components/pdp/pdp-sticky-cta.tsx`
- Create: `apps/web/test/components/pdp/pdp-sticky-cta.test.ts`

### Steps

- [ ] **Step 1: Smoke test `apps/web/test/components/pdp/pdp-sticky-cta.test.ts`**

```ts
import { describe, expect, it } from "bun:test";
import { PdpStickyCta } from "@/components/pdp/pdp-sticky-cta";

describe("PdpStickyCta", () => {
  it("exports a function", () => {
    expect(typeof PdpStickyCta).toBe("function");
  });
});
```

- [ ] **Step 2: Implement `apps/web/src/components/pdp/pdp-sticky-cta.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import type { ProductMeta } from "@/lib/products";
import { RETAIL_PRICE } from "@/lib/products";
import { useCart } from "@/components/cart/cart-store";

interface PdpStickyCtaProps {
  product: ProductMeta;
  /** id of the element to observe — when offscreen, sticky shows. */
  observeTargetId: string;
}

export function PdpStickyCta({ product, observeTargetId }: PdpStickyCtaProps) {
  const t = useTranslations("pages.productos");
  const [visible, setVisible] = useState(false);
  const target = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = document.getElementById(observeTargetId);
    if (!el) return;
    target.current = el;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        setVisible(!entry.isIntersecting);
      },
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [observeTargetId]);

  const onAdd = () => {
    useCart.getState().addItem(product, RETAIL_PRICE);
    useCart.getState().openDrawer();
  };

  return (
    <div
      aria-hidden={!visible}
      className="md:hidden"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        padding: "12px 16px calc(12px + env(safe-area-inset-bottom))",
        transform: visible ? "translateY(0)" : "translateY(110%)",
        transition: "transform 250ms cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      <div className="flex items-center gap-3 rounded-full bg-white p-2 pl-3 shadow-[0_18px_48px_rgba(13,27,53,0.18)]">
        <div
          className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full"
          style={{ background: product.bg }}
        >
          <Image
            src={product.image}
            alt=""
            fill
            sizes="40px"
            className="object-contain"
          />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-navy">{product.name}</p>
          <p className="text-xs text-navy/60">${RETAIL_PRICE} MXN</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white"
        >
          {t("sticky_cta.add")}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run typecheck + test → PASS**

```bash
cd apps/web && bun run typecheck && bun test ./test/components/pdp/pdp-sticky-cta.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/pdp/pdp-sticky-cta.tsx apps/web/test/components/pdp/pdp-sticky-cta.test.ts
git commit -m "feat(pdp): add mobile sticky CTA driven by IntersectionObserver"
```

---

## Task 10: PdpJsonLd (Server, via next/script inline)

**Files:**
- Create: `apps/web/src/components/pdp/pdp-jsonld.tsx`
- Create: `apps/web/test/components/pdp/pdp-jsonld.test.ts`

### Steps

- [ ] **Step 1: Smoke test `apps/web/test/components/pdp/pdp-jsonld.test.ts`**

```ts
import { describe, expect, it } from "bun:test";
import { buildPdpJsonLd } from "@/components/pdp/pdp-jsonld";
import { NOVA_PRODUCTS, RETAIL_PRICE } from "@/lib/products";
import { PRODUCTS_CONTENT } from "@/lib/products-content";

describe("buildPdpJsonLd", () => {
  it("emits a Product schema with the right fields", () => {
    const product = NOVA_PRODUCTS.find((p) => p.slug === "energy")!;
    const content = PRODUCTS_CONTENT["energy"];
    const data = buildPdpJsonLd({
      product,
      content,
      siteUrl: "https://novapatch.com",
      locale: "mx",
    });
    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@type"]).toBe("Product");
    expect(data.name).toContain("Energy");
    expect(data.image).toBe("https://novapatch.com/products/Energy.webp");
    expect(data.offers.price).toBe(RETAIL_PRICE);
    expect(data.offers.priceCurrency).toBe("MXN");
    expect(data.offers.url).toBe("https://novapatch.com/mx/productos/energy");
  });
});
```

- [ ] **Step 2: Implement `apps/web/src/components/pdp/pdp-jsonld.tsx`**

The component renders a `<script type="application/ld+json">` element with the JSON serialized as a child string. React 19 + Next.js 15 allows children for `<script type="application/ld+json">`. We do NOT use `dangerouslySetInnerHTML`.

```tsx
import type { ProductMeta } from "@/lib/products";
import type { ProductContent } from "@/lib/products-content";
import { RETAIL_PRICE } from "@/lib/products";

interface BuildArgs {
  product: ProductMeta;
  content: ProductContent;
  siteUrl: string;
  locale: string;
}

interface ProductJsonLd {
  "@context": "https://schema.org";
  "@type": "Product";
  name: string;
  description: string;
  image: string;
  brand: { "@type": "Brand"; name: "Novapatch" };
  offers: {
    "@type": "Offer";
    url: string;
    priceCurrency: "MXN";
    price: number;
    availability: "https://schema.org/InStock";
  };
}

export function buildPdpJsonLd(args: BuildArgs): ProductJsonLd {
  const { product, content, siteUrl, locale } = args;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `Novapatch ${product.name}`,
    description: content.hero.subhead,
    image: `${siteUrl}${product.image}`,
    brand: { "@type": "Brand", name: "Novapatch" },
    offers: {
      "@type": "Offer",
      url: `${siteUrl}/${locale}/productos/${product.slug}`,
      priceCurrency: "MXN",
      price: RETAIL_PRICE,
      availability: "https://schema.org/InStock",
    },
  };
}

interface PdpJsonLdProps {
  product: ProductMeta;
  content: ProductContent;
  siteUrl: string;
  locale: string;
}

export function PdpJsonLd(props: PdpJsonLdProps) {
  const data = buildPdpJsonLd(props);
  // Children-as-string for ld+json is the React-19-friendly pattern that
  // avoids dangerouslySetInnerHTML. Next.js + React 19 emit this verbatim.
  // Reference: https://react.dev/reference/react-dom/components/script
  return (
    <script type="application/ld+json">{JSON.stringify(data)}</script>
  );
}
```

- [ ] **Step 3: Run test → PASS** (relies on `PRODUCTS_CONTENT.energy` being populated, which Task 2 did)

```bash
cd apps/web && bun test ./test/components/pdp/pdp-jsonld.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/pdp/pdp-jsonld.tsx apps/web/test/components/pdp/pdp-jsonld.test.ts
git commit -m "feat(pdp): emit Product JSON-LD structured data"
```

---

## Task 11: PDP page route + generateStaticParams + generateMetadata + not-found

**Files:**
- Create: `apps/web/src/app/[locale]/productos/[slug]/page.tsx`
- Create: `apps/web/src/app/[locale]/productos/[slug]/not-found.tsx`

### Steps

- [ ] **Step 1: Create `apps/web/src/app/[locale]/productos/[slug]/not-found.tsx`**

```tsx
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function ProductNotFound() {
  // not-found.tsx does not receive params in App Router; default to "mx".
  const locale = "mx";
  const t = await getTranslations({
    locale,
    namespace: "pages.productos.not_found",
  });
  return (
    <section className="bg-cream py-32">
      <div className="mx-auto max-w-xl px-4 text-center">
        <h1 className="font-outfit text-3xl font-black text-navy lg:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-4 text-navy/70">{t("lead")}</p>
        <Link
          href={`/${locale}/tienda`}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white hover:bg-coral/90"
        >
          {t("cta")}
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create `apps/web/src/app/[locale]/productos/[slug]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { NOVA_PRODUCTS } from "@/lib/products";
import { getProductContent } from "@/lib/products-content";
import { getSiteUrl } from "@/lib/site";
import { PdpHero } from "@/components/pdp/pdp-hero";
import { PdpTarget } from "@/components/pdp/pdp-target";
import { PdpProblem } from "@/components/pdp/pdp-problem";
import { PdpMoments } from "@/components/pdp/pdp-moments";
import { PdpFormula } from "@/components/pdp/pdp-formula";
import { PdpScience } from "@/components/pdp/pdp-science";
import { PdpPromises } from "@/components/pdp/pdp-promises";
import { PdpClaims } from "@/components/pdp/pdp-claims";
import { PdpFaq } from "@/components/pdp/pdp-faq";
import { PdpStickyCta } from "@/components/pdp/pdp-sticky-cta";
import { PdpJsonLd } from "@/components/pdp/pdp-jsonld";

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return NOVA_PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = NOVA_PRODUCTS.find((p) => p.slug === slug);
  const content = getProductContent(slug);
  if (!product || !content) return { title: "Novapatch" };

  const siteUrl = getSiteUrl();
  const title = `Novapatch ${product.name} · ${content.hero.eyebrow}`;
  const description = content.hero.subhead;
  const image = `${siteUrl}${product.image}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: image, width: 1200, height: 1200, alt: product.name }],
      type: "website",
      url: `${siteUrl}/${locale}/productos/${slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { locale, slug } = await params;
  const product = NOVA_PRODUCTS.find((p) => p.slug === slug);
  const content = getProductContent(slug);
  if (!product || !content) notFound();

  const heroAnchorId = "pdp-hero-cta";
  const siteUrl = getSiteUrl();

  return (
    <>
      <PdpJsonLd
        product={product}
        content={content}
        siteUrl={siteUrl}
        locale={locale}
      />
      <div id={heroAnchorId}>
        <PdpHero product={product} content={content.hero} />
      </div>
      <PdpTarget locale={locale} content={content.target} />
      <PdpProblem content={content.problem} />
      <PdpMoments content={content.moments} />
      <PdpFormula locale={locale} content={content.formula} />
      <PdpScience content={content.science} />
      <PdpPromises content={content.promises} />
      <PdpClaims content={content.claims} />
      <PdpFaq faq={content.faq} />
      <PdpStickyCta product={product} observeTargetId={heroAnchorId} />
    </>
  );
}
```

- [ ] **Step 3: Run typecheck**

```bash
cd apps/web && bun run typecheck
```

Expected: PASS.

- [ ] **Step 4: Smoke check** (optional, dev server). Visit `http://localhost:3000/mx/productos/energy` and confirm all sections render.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/[locale]/productos/[slug]/page.tsx apps/web/src/app/[locale]/productos/[slug]/not-found.tsx
git commit -m "feat(pdp): add /productos/[slug] route with SSG and full metadata"
```

---

## Task 12: Tienda hero + grid + product card shop

**Files:**
- Create: `apps/web/src/components/shop/tienda-hero.tsx`
- Create: `apps/web/src/components/shop/product-card-shop.tsx`
- Create: `apps/web/src/components/shop/product-grid-shop.tsx`
- Create: `apps/web/test/components/shop/shop-components.test.ts`

### Steps

- [ ] **Step 1: Implement `apps/web/src/components/shop/tienda-hero.tsx`** (Server)

```tsx
import { getTranslations } from "next-intl/server";

interface TiendaHeroProps {
  locale: string;
}

export async function TiendaHero({ locale }: TiendaHeroProps) {
  const t = await getTranslations({ locale, namespace: "pages.tienda.hero" });
  return (
    <section className="bg-cream pt-24 pb-12">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <span className="text-xs uppercase tracking-wider text-coral">
          {t("eyebrow")}
        </span>
        <h1 className="mt-3 font-outfit text-4xl font-black leading-tight text-navy lg:text-6xl">
          {t("title_a")}{" "}
          <span className="font-newsreader italic font-normal text-coral">
            {t("title_b_italic")}
          </span>
        </h1>
        <p className="mt-4 text-navy/70">{t("lead")}</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Implement `apps/web/src/components/shop/product-card-shop.tsx`** (Client)

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ProductMeta } from "@/lib/products";
import { RETAIL_PRICE } from "@/lib/products";
import { useCart } from "@/components/cart/cart-store";

interface ProductCardShopProps {
  product: ProductMeta;
  locale: string;
}

export function ProductCardShop({ product, locale }: ProductCardShopProps) {
  const t = useTranslations("pages.home.product_grid.card");
  const onAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    useCart.getState().addItem(product, RETAIL_PRICE);
    useCart.getState().openDrawer();
  };

  const href = `/${locale}/productos/${product.slug}`;

  return (
    <article
      data-slug={product.slug}
      data-testid={`pcard-${product.slug}`}
      className="group relative overflow-hidden rounded-3xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
    >
      <Link href={href} className="block">
        <div
          className="relative aspect-[1/1.05] overflow-hidden"
          style={{
            background: `radial-gradient(60% 60% at 50% 40%, ${product.color}55, ${product.bg})`,
          }}
        >
          {product.popular && (
            <span className="absolute left-3 top-3 rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold uppercase text-white">
              {t("popular")}
            </span>
          )}
          <Image
            src={product.image}
            alt={product.name}
            fill
            loading="lazy"
            sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw"
            className="object-contain p-8 transition-transform duration-500 [@media(hover:hover)]:group-hover:scale-105 [@media(hover:hover)]:group-hover:-rotate-2"
          />
        </div>
        <div className="p-5">
          <p
            data-testid="pcard-name"
            className="font-outfit text-2xl font-black text-navy"
          >
            {product.name}
          </p>
          <p className="text-sm text-navy/70">
            {product.tagline} · {t("units_short")}
          </p>
          <hr className="my-3 border-navy/10" />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-outfit text-xl font-black text-navy">
                ${RETAIL_PRICE}
              </p>
              <p className="text-xs text-navy/60">{t("price_per_month")}</p>
            </div>
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex items-center gap-1 rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white hover:bg-coral/90"
            >
              {t("add")} +
            </button>
          </div>
        </div>
      </Link>
    </article>
  );
}
```

- [ ] **Step 3: Implement `apps/web/src/components/shop/product-grid-shop.tsx`** (Client wrapper)

```tsx
"use client";

import { NOVA_PRODUCTS } from "@/lib/products";
import { ProductCardShop } from "@/components/shop/product-card-shop";

interface ProductGridShopProps {
  locale: string;
}

export function ProductGridShop({ locale }: ProductGridShopProps) {
  return (
    <section className="bg-cream pb-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {NOVA_PRODUCTS.map((p) => (
            <ProductCardShop key={p.slug} product={p} locale={locale} />
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Smoke tests `apps/web/test/components/shop/shop-components.test.ts`**

```ts
import { describe, expect, it, beforeEach } from "bun:test";
import { TiendaHero } from "@/components/shop/tienda-hero";
import { ProductCardShop } from "@/components/shop/product-card-shop";
import { ProductGridShop } from "@/components/shop/product-grid-shop";
import { useCart } from "@/components/cart/cart-store";
import { NOVA_PRODUCTS, RETAIL_PRICE } from "@/lib/products";

beforeEach(() => {
  useCart.setState({ items: [], drawerOpen: false, hydrated: true });
});

describe("Shop components", () => {
  it("TiendaHero exports a function", () => {
    expect(typeof TiendaHero).toBe("function");
  });
  it("ProductCardShop exports a function", () => {
    expect(typeof ProductCardShop).toBe("function");
  });
  it("ProductGridShop exports a function", () => {
    expect(typeof ProductGridShop).toBe("function");
  });

  it("addItem from card flow works", () => {
    const p = NOVA_PRODUCTS[0]!;
    useCart.getState().addItem(p, RETAIL_PRICE);
    useCart.getState().openDrawer();
    expect(useCart.getState().items[0]?.slug).toBe(p.slug);
    expect(useCart.getState().drawerOpen).toBe(true);
  });
});
```

- [ ] **Step 5: Run typecheck + tests → PASS**

```bash
cd apps/web && bun run typecheck && bun test ./test/components/shop/shop-components.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/shop/tienda-hero.tsx apps/web/src/components/shop/product-card-shop.tsx apps/web/src/components/shop/product-grid-shop.tsx apps/web/test/components/shop/shop-components.test.ts
git commit -m "feat(shop): add Tienda hero, product card with PDP link, and grid"
```

---

## Task 13: Tienda page route

**Files:**
- Create: `apps/web/src/app/[locale]/tienda/page.tsx`

### Steps

- [ ] **Step 1: Implement `apps/web/src/app/[locale]/tienda/page.tsx`**

```tsx
import type { Metadata } from "next";
import { TiendaHero } from "@/components/shop/tienda-hero";
import { ProductGridShop } from "@/components/shop/product-grid-shop";
import { getSiteUrl } from "@/lib/site";

interface TiendaPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: TiendaPageProps): Promise<Metadata> {
  const { locale } = await params;
  const siteUrl = getSiteUrl();
  return {
    title: "La tienda · Novapatch",
    description: "Seis parches, un bienestar para cada día.",
    openGraph: {
      title: "La tienda · Novapatch",
      description: "Seis parches, un bienestar para cada día.",
      url: `${siteUrl}/${locale}/tienda`,
      type: "website",
    },
  };
}

export default async function TiendaPage({ params }: TiendaPageProps) {
  const { locale } = await params;
  return (
    <>
      <TiendaHero locale={locale} />
      <ProductGridShop locale={locale} />
    </>
  );
}
```

- [ ] **Step 2: Typecheck + run dev server smoke check**

```bash
cd apps/web && bun run typecheck
```

Visit `http://localhost:3000/mx/tienda` to confirm.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/[locale]/tienda/page.tsx
git commit -m "feat(shop): add /tienda route composing hero + grid"
```

---

## Task 14: Navbar "Tienda" link

**Files:**
- Modify: `apps/web/src/components/site/navbar.tsx`
- Modify: `apps/web/test/components/site/navbar.test.ts` (if it exists; only update if breakage)

### Steps

- [ ] **Step 1: Read the current navbar file** to understand the link cluster structure.

```bash
sed -n '1,140p' apps/web/src/components/site/navbar.tsx
```

- [ ] **Step 2: Add a "Tienda" link**

Find where the home anchors are rendered (`{isHome && (<nav … />)}`). Restructure so that `Tienda` shows everywhere, and home anchors still only show on home. Ensure there is a `<Link>` import from `next/link` and a `useTranslations` hook for `components.navbar.links`.

Example shape (adapt to existing markup):

```tsx
import Link from "next/link";
import { useTranslations } from "next-intl";
// existing imports preserved …

// inside the component:
const tLinks = useTranslations("components.navbar.links");

// Desktop link cluster (replace existing nav block):
<nav className="hidden items-center gap-6 md:flex">
  <Link href={`/${locale}/tienda`} className={linkCls}>
    {tLinks("tienda")}
  </Link>
  {isHome &&
    homeAnchors.map((a) => (
      <a key={a.key} href={a.href} className={linkCls}>
        {tHome(a.key)}
      </a>
    ))}
</nav>
```

In the mobile sheet, add the Tienda link before the home anchors:

```tsx
<Link
  href={`/${locale}/tienda`}
  onClick={() => setSheetOpen(false)}
  className="text-base text-foreground"
>
  {tLinks("tienda")}
</Link>
```

- [ ] **Step 3: Run typecheck + existing navbar tests** to confirm nothing breaks.

```bash
cd apps/web && bun run typecheck && bun test ./test/components/site/navbar.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/site/navbar.tsx apps/web/test/components/site/navbar.test.ts
git commit -m "feat(navbar): add Tienda link on every page"
```

---

## Task 15: sitemap.ts + robots.ts

**Files:**
- Create: `apps/web/src/app/sitemap.ts`
- Create: `apps/web/src/app/robots.ts` (only if it does not already exist — check first)

### Steps

- [ ] **Step 1: Check for existing files**

```bash
ls apps/web/src/app/sitemap.ts apps/web/src/app/robots.ts 2>&1 | tee /tmp/sitemap-check.log
```

If `sitemap.ts` exists, modify it to add the new entries instead of replacing. If `robots.ts` exists, leave it alone.

- [ ] **Step 2: Implement `apps/web/src/app/sitemap.ts`**

```ts
import type { MetadataRoute } from "next";
import { NOVA_PRODUCTS } from "@/lib/products";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const now = new Date();
  const out: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    out.push({
      url: `${base}/${locale}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    });
    out.push({
      url: `${base}/${locale}/tienda`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    });
    out.push({
      url: `${base}/${locale}/suscripciones`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    });
    for (const p of NOVA_PRODUCTS) {
      out.push({
        url: `${base}/${locale}/productos/${p.slug}`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  }

  return out;
}
```

- [ ] **Step 3: Implement `apps/web/src/app/robots.ts` (only if not present)**

```ts
import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
```

- [ ] **Step 4: Typecheck + smoke check**

```bash
cd apps/web && bun run typecheck
curl -s http://localhost:3000/sitemap.xml | head -40   # if dev server running
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/sitemap.ts apps/web/src/app/robots.ts
git commit -m "feat(seo): add sitemap covering tienda, suscripciones, and PDPs"
```

(If `robots.ts` already existed, drop it from the `git add`.)

---

## Task 16: E2E Playwright happy path — Tienda + PDP

**Files:**
- Create: `apps/web/e2e/tienda-pdp.spec.ts`

### Steps

- [ ] **Step 1: Create `apps/web/e2e/tienda-pdp.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test.describe("Tienda + PDP happy path", () => {
  test("goto tienda, navigate to PDP, add one-time, then subscribe", async ({
    page,
  }) => {
    await page.goto("/mx/tienda");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Seis parches")).toBeVisible();

    // Click Energy card to navigate to PDP
    await page.getByTestId("pcard-energy").locator("a").first().click();
    await expect(page).toHaveURL(/\/mx\/productos\/energy$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Add one-time
    await page.getByRole("button", { name: /Agregar · \$750 MXN/ }).click();
    const drawer = page.getByLabel(/Tu bolsa/);
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Energy")).toBeVisible();

    await page.keyboard.press("Escape");

    // Subscribe flow: open the freq picker, pick 30d, confirm.
    // First click expands the picker.
    await page
      .getByRole("button", { name: /Suscribirme desde \$\d+\/mes/ })
      .click();
    // Pick 30d (default selected, but click anyway to verify aria-pressed)
    await page
      .getByRole("button", { name: /^30d$/i })
      .first()
      .click();
    // Confirm — button label changed
    await page
      .getByRole("button", { name: /Suscribirme · cada 30d −20%/ })
      .click();

    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Cada 30 días · −20%")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run e2e tests** (needs the dev server running)

```bash
cd apps/web && bun run test:e2e
```

Expected: existing home-cart spec + new tienda-pdp spec both pass (2 passed).

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/tienda-pdp.spec.ts
git commit -m "test(shop): Playwright e2e for tienda + PDP add-to-bag and subscribe"
```

---

## Task 17: ROADMAP update

**Files:**
- Modify: `docs/superpowers/ROADMAP.md`

### Steps

- [ ] **Step 1: Read current ROADMAP**

```bash
grep -n "^| 4b\|^| 6 " docs/superpowers/ROADMAP.md
```

- [ ] **Step 2: Update Plan #4b row to `**done** (2026-04-27)`** and add a brief note: "shipped — `/tienda` + `/productos/[slug]` (SSG, JSON-LD, sitemap), per-product editorial content from marketing knowledge base". Append a line to "Decision history" noting the swap is complete.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/ROADMAP.md
git commit -m "docs(roadmap): mark Plan #4b (Tienda + PDP) done"
```

---

## Self-review

- **Spec coverage:**
  - Routes `/tienda` + `/productos/[slug]` → Tasks 11 + 13.
  - PDP 9 sections (Hero, Target, Problem, Moments, Formula, Science, Promises, Claims, FAQ) → Tasks 5 + 6 + 7 + 8.
  - Sticky CTA → Task 9.
  - JSON-LD → Task 10.
  - PDP CTA dual flow (one-time + subscribe with freq picker) → Task 4.
  - Per-product editorial content → Tasks 2 + 3 (split for review checkpoints).
  - Tienda hero + grid + linked card → Task 12.
  - Navbar Tienda link → Task 14.
  - Sitemap + robots → Task 15.
  - E2E → Task 16.
  - ROADMAP → Task 17.

- **No placeholders.** Every task has full code blocks. The only "TBD" content is the editorial copy in Tasks 2 + 3, which is intentional — that copy must be authored from source `.docx` files at execution time, and the plan provides the field-by-field mapping rules.

- **Type / method consistency:**
  - `addItem(p, price, subscription?)` — same signature in Task 4 (PdpCtaBlock), Task 9 (StickyCta), Task 12 (ProductCardShop).
  - `getProductContent(slug)` returns `ProductContent | undefined`; PDP page calls `notFound()` if undefined (Task 11).
  - `getSiteUrl()` returns string with no trailing slash; used in Task 10 (JSON-LD), Task 11 (metadata), Task 13 (tienda metadata), Task 15 (sitemap, robots).
  - `LucideIconName` enum consumed by `ICONS` map in Task 6 — closed set; both files agree.
  - i18n keys (`components.navbar.links.tienda`, `pages.productos.cta.add`, etc.) declared in Task 1 and referenced from Tasks 4, 9, 12, 14.
  - Keyframe `pulseHaloPdp` introduced in Task 5; no collision with `pulseHaloB` (home Hero), `floatPatchB` (home Hero), `nc-descend-c` (home Absorption).

- **Project constraints respected:**
  - `exactOptionalPropertyTypes` — no optional props are passed as `key={undefined}`.
  - `"use client"` line 1 in PdpCtaBlock, PdpHero, PdpFaq, PdpStickyCta, ProductCardShop, ProductGridShop.
  - bun:test, no RTL — all tests are smoke-imports + cart store assertions + pure helper assertions.
  - Newsreader italic span uses `font-newsreader italic font-normal`.
  - Tailwind v4 tokens are `var(--color-*)`.
  - JSON-LD avoids `dangerouslySetInnerHTML` per repo policy; uses children-as-string under `<script type="application/ld+json">`.

- **Commit hygiene:** every task ends with one conventional commit. Total: 17 commits.

---

**Execution handoff:** Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — Fresh subagent per task, two-stage review, fast iteration. Best for plans with independent component tasks like this one.
2. **Inline Execution** — Single-session batch execution with checkpoints.

Default to (1) unless you say otherwise.
