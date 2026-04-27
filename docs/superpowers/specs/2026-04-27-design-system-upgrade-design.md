# Design System Upgrade — Design Spec

**Status:** Approved — ready for implementation plan.
**Roadmap reference:** Plan #2 of [`docs/superpowers/ROADMAP.md`](../ROADMAP.md).
**Source-of-truth:** [`docs/superpowers/source/DESIGN.md`](../source/DESIGN.md) (sections 2–8).
**Scope:** Foundational design-system tokens — fonts, color (brand + 6 product triads), type scale, radii, shadows, animation primitives — plus migration of existing `brand-*` token usages to the new naming.

---

## Goals

1. Apply the DESIGN doc's foundation (sections 2-8) as Tailwind v4 tokens via `@theme inline` in `globals.css`.
2. Load Outfit (display + body) and Newsreader (editorial italic) via `next/font/google` with the minimal weight subset required by the DESIGN.
3. Expose every token as a Tailwind utility (e.g. `text-display-xl`, `bg-coral`, `bg-product-energy-bg`, `shadow-cta`, `ease-out`, `duration-medium`).
4. Migrate every existing `brand-*` token usage to the new naming. End state: `grep -rn "brand-" apps/web/src` returns empty.
5. Respect `prefers-reduced-motion` globally.
6. Visual smoke test: existing pages (home, nosotros, faq, cuenta, influencers, etc.) render without regressions after the migration.

## Non-Goals

- `nc-descend` keyframe and the Absorption section signature animation (Plan #9).
- Hero auto-rotation logic (Plan #9).
- Plan Builder expand/collapse transitions (Plan #7).
- Custom Button / Card / Stat-chip / Frequency-selector / Eyebrow components (Plan #7 / #9 when their context exists).
- Dark-mode token review against DESIGN (the `:root .dark` block stays as shadcn defaults; DESIGN does not specify a dark variant).
- A `/dev/design-system` showcase page (out — can be added later as a small follow-up).
- Tests (no functional logic to test; validation is type-check + visual smoke).

---

## Decisions log

These reflect the brainstorming Q&A on 2026-04-27:

| # | Topic | Decision |
|---|---|---|
| 1 | Scope | Pure foundation. Component animations (hero, plan builder) defer to their plans. |
| 2 | Color format | OKLCH everywhere, with HEX equivalent in a comment per token for DESIGN traceability. |
| 3 | Token migration | Rename `brand-*` → DESIGN names (`coral`, `navy`, `sky`, `cream`). Full migration in this plan; no aliases. |
| 4 | Font loader | `next/font/google` (zero config, optimal performance). |
| 5 | Font weights | Outfit 400 / 500 / 600 / 700 / 800 / 900; Newsreader 400-italic + 600-italic. |
| 6 | Type scale | Tailwind v4 `@theme inline` with tuple syntax (`--text-X--line-height`, etc.) so utilities like `text-display-xl` carry their own height + tracking + weight. |
| 7 | Animation primitives | Easings + duration tokens + `prefers-reduced-motion`. No `nc-descend` yet (defer to Absorption in Plan #9). |

---

## File map

### Created

| File | Responsibility |
|---|---|
| `apps/web/src/lib/fonts.ts` | `next/font/google` config for Outfit + Newsreader, exports `outfit` and `newsreader` with their CSS variables. |

### Modified

| File | Change |
|---|---|
| `apps/web/src/app/[locale]/layout.tsx` | Apply `outfit.variable` + `newsreader.variable` classes to the `<html>` element. |
| `apps/web/src/app/globals.css` | Add brand color tokens (refresh + new), per-product triads, type scale, radii (DESIGN values), shadows, easings, durations, and the `prefers-reduced-motion` rule. Drop the legacy `--color-brand-*` tokens. |
| `apps/web/src/components/site/navbar.tsx` | Replace `brand-*` class names with new names. |
| `apps/web/src/components/site/footer.tsx` | Replace `brand-*` class names. |
| `apps/web/src/app/[locale]/cuenta/layout.tsx` | Replace `brand-*` class names. |
| Any static page that uses `brand-*` | Replace (e.g. nosotros, garantia, faq, suscripciones, privacidad, terminos, terminos-influencers, influencers, influencers/aplicar). The exact set is the output of `grep -rn "brand-" apps/web/src`. |

---

## Detailed design

### 1. Fonts

**`apps/web/src/lib/fonts.ts`:**

```ts
import { Outfit, Newsreader } from "next/font/google";

export const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-outfit",
  display: "swap",
});

export const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["italic"],
  variable: "--font-newsreader",
  display: "swap",
});
```

**`apps/web/src/app/[locale]/layout.tsx`** — apply both `variable` classes to the `<html>` element so the CSS variables resolve everywhere:

```tsx
import { outfit, newsreader } from "@/lib/fonts";
// ...
return (
  <ClerkProvider>
    <html lang={locale} className={`${outfit.variable} ${newsreader.variable}`}>
      <body>
        {/* ... */}
      </body>
    </html>
  </ClerkProvider>
);
```

**`globals.css` `@theme inline`** — re-declare semantic font tokens:

```css
--font-display: var(--font-outfit);
--font-editorial: var(--font-newsreader);
--font-sans: var(--font-outfit);
```

`--font-sans` is the Tailwind preflight default for `<body>`, so Outfit becomes the global default. `font-editorial` is the utility for `<em>` editorial italics in headings.

Why no `300` weight: DESIGN lists "300, 400, 500, 600, 700, 800, 900" as available, but the documented hierarchy never uses `300`. Skip to keep the font payload small (~80 KB savings).

Why Newsreader at only `400 italic` + `600 italic`: DESIGN section 3.7 reserves Newsreader exclusively for `<em>` editorial accents inside h1/h2. Italic-only with two weights covers the documented usage.

### 2. Color tokens

All in `@theme inline`. OKLCH values, with the HEX from the DESIGN doc preserved in a comment per token.

**Brand:**

```css
/* Coral — CTAs, accents, momentos de acción */
--color-coral:       oklch(0.65 0.21 30);     /* #E8503A */
--color-coral-light: oklch(0.74 0.18 30);     /* #FF7A65 */
--color-coral-dark:  oklch(0.56 0.20 30);     /* #C43B28 */

/* Navy — texto principal, superficies oscuras */
--color-navy:        oklch(0.21 0.06 263);    /* #0D1B35 */
--color-navy-light:  oklch(0.32 0.09 263);    /* #1D3461 */

/* Ocean — links, primary actions sobre claros */
--color-ocean:       oklch(0.45 0.13 240);    /* #005088 */
--color-ocean-light: oklch(0.51 0.14 240);    /* #0068AA */
--color-ocean-dark:  oklch(0.37 0.13 240);    /* #003D6B */

/* Sky — secondary accent */
--color-sky:         oklch(0.71 0.10 235);    /* #5BA8D5 */
--color-sky-light:   oklch(0.87 0.06 235);    /* #B8DDEF */
--color-sky-pale:    oklch(0.96 0.02 235);    /* #EAF5FB */

/* Teal — diagrams, savings indicators */
--color-teal:        oklch(0.69 0.13 195);    /* #1CB1BC */
--color-teal-pale:   oklch(0.96 0.02 195);    /* #E4F4F4 */

/* Gold — patch texture accent (NOVAPATCH pill in Absorption) */
--color-gold:        oklch(0.85 0.16 90);     /* #F5C628 */

/* Lime — offer highlights (puntual) */
--color-lime:        oklch(0.85 0.17 110);    /* #C9D849 */
--color-lime-dark:   oklch(0.74 0.16 110);    /* #A8B42A */
```

**Surfaces:**

```css
--color-cream:   oklch(0.98 0.01 70);     /* #FAF7F2 — bg principal */
--color-warm:    oklch(0.98 0.02 70);     /* #FEF7ED */
--color-blush:   oklch(0.96 0.01 25);     /* #F8EDEB — footer, La ciencia */
--color-surface: oklch(0.98 0 0);         /* #FAFAFA */
```

**Per-product (6 triads × 3 = 18 tokens):**

```css
/* Energy */
--color-product-energy:     oklch(0.78 0.10 245);  /* #83B5F4 */
--color-product-energy-ink: oklch(0.45 0.14 250);  /* #1A5C9A */
--color-product-energy-bg:  oklch(0.96 0.02 245);  /* #EBF4FB */

/* Sleep */
--color-product-sleep:      oklch(0.69 0.13 195);  /* #1EB1BC */
--color-product-sleep-ink:  oklch(0.45 0.10 175);  /* #0F6B5C */
--color-product-sleep-bg:   oklch(0.96 0.02 195);  /* #E4F4F4 */

/* Glow */
--color-product-glow:       oklch(0.65 0.20 25);   /* #F25C54 */
--color-product-glow-ink:   oklch(0.50 0.18 25);   /* #B83525 */
--color-product-glow-bg:    oklch(0.96 0.02 25);   /* #FAF0EE */

/* Shield */
--color-product-shield:     oklch(0.78 0.16 65);   /* #FFA849 */
--color-product-shield-ink: oklch(0.51 0.12 75);   /* #8C6000 */
--color-product-shield-bg:  oklch(0.96 0.03 80);   /* #FAF6E9 */

/* Zen */
--color-product-zen:        oklch(0.59 0.10 250);  /* #4E82BC */
--color-product-zen-ink:    oklch(0.42 0.13 255);  /* #2A5490 */
--color-product-zen-bg:     oklch(0.95 0.02 245);  /* #EBF0F9 */

/* Woman */
--color-product-woman:      oklch(0.72 0.10 320);  /* #C693C4 */
--color-product-woman-ink:  oklch(0.40 0.16 310);  /* #6B3080 */
--color-product-woman-bg:   oklch(0.95 0.03 315);  /* #F3EBF9 */
```

**Cleanup:** drop the legacy `--color-brand-coral`, `--color-brand-deep-blue`, `--color-brand-sky`, `--color-brand-cream` from the `@theme inline` block. Component migrations (below) handle the class-name updates.

**Tailwind utilities autogenerated:** `bg-coral`, `text-coral-dark`, `bg-cream`, `text-navy`, `bg-product-energy`, `bg-product-energy-bg`, `text-product-energy-ink`, etc.

### 3. Type scale

In `@theme inline`. Tailwind v4 tuple syntax binds line-height / letter-spacing / weight to each text utility.

```css
/* Display (clamp para fluidez) */
--text-display-xl: clamp(48px, 6vw, 72px);
--text-display-xl--line-height: 0.98;
--text-display-xl--letter-spacing: -0.035em;
--text-display-xl--font-weight: 900;

--text-display-lg: clamp(40px, 5vw, 62px);
--text-display-lg--line-height: 1.0;
--text-display-lg--letter-spacing: -0.03em;
--text-display-lg--font-weight: 900;

--text-display-md: clamp(36px, 4.6vw, 56px);
--text-display-md--line-height: 1.02;
--text-display-md--letter-spacing: -0.03em;
--text-display-md--font-weight: 900;

--text-display-sm: clamp(28px, 3.8vw, 44px);
--text-display-sm--line-height: 1.05;
--text-display-sm--letter-spacing: -0.025em;
--text-display-sm--font-weight: 800;

/* Inline headings */
--text-h3: 22px;
--text-h3--line-height: 1.15;
--text-h3--letter-spacing: -0.02em;
--text-h3--font-weight: 700;

--text-h4: 18px;
--text-h4--line-height: 1.2;
--text-h4--letter-spacing: -0.015em;
--text-h4--font-weight: 700;

/* Body */
--text-body-lg: 16.5px;
--text-body-lg--line-height: 1.6;

--text-body: 15px;
--text-body--line-height: 1.6;

--text-body-sm: 13.5px;
--text-body-sm--line-height: 1.55;

--text-caption: 12px;
--text-caption--line-height: 1.4;

/* Eyebrow */
--text-eyebrow: 11px;
--text-eyebrow--line-height: 1.2;
--text-eyebrow--letter-spacing: 0.18em;
--text-eyebrow--font-weight: 700;
```

**Utilities autogenerated:** `text-display-xl`, `text-display-lg`, `text-display-md`, `text-display-sm`, `text-h3`, `text-h4`, `text-body-lg`, `text-body`, `text-body-sm`, `text-caption`, `text-eyebrow`.

`text-eyebrow` includes weight 700 and letter-spacing automatically; the `uppercase` modifier is applied per-use with the `uppercase` utility (DESIGN treats eyebrow as a component pattern, section 3.6 — uppercase is a styling decision per consumer).

### 4. Radii

In `@theme inline`:

```css
--radius-sm:   8px;     /* badges pequeños, chips */
--radius-md:   12px;    /* cards de items en lists */
--radius-lg:   16px;    /* cards medianas, inputs, stat chips */
--radius-xl:   18px;    /* legend cards, info boxes */
--radius-2xl:  22px;    /* containers de sección, dropdowns */
--radius-3xl:  24px;    /* cards principales, plan summary */
--radius-full: 9999px;  /* pills, buttons, dots */
```

**Replaces** the existing shadcn-derived radii in `@theme inline` (which were `--radius-sm: calc(var(--radius) - 4px)` etc., anchored to `--radius: 0.625rem` in `:root`). The new declarations are literal values from DESIGN. The `--radius` anchor in `:root` becomes orphaned but is harmless — it stays in the file (shadcn components don't read it directly; they consume the `--radius-*` utilities, which now resolve to DESIGN values). Differences between the previous shadcn-default-derived values and DESIGN values are 2-6px in the small/medium range — acceptable for shadcn components (Button, Card, Sheet, Accordion). Visual smoke test confirms.

### 5. Shadows

In `@theme inline`:

```css
--shadow-card:        0 4px 14px rgb(13 27 53 / 0.04);   /* neutral cards */
--shadow-card-active: 0 12px 32px rgb(13 27 53 / 0.08);  /* hover / selected */
--shadow-card-hero:   0 16px 44px rgb(13 27 53 / 0.10);  /* highlighted (plan summary) */
--shadow-bar:         0 24px 64px rgb(13 27 53 / 0.32);  /* floating bottom bar */
--shadow-cta:         0 10px 24px rgb(232 80 58 / 0.4);  /* coral CTAs floating */
```

**Utilities autogenerated:** `shadow-card`, `shadow-card-active`, `shadow-card-hero`, `shadow-bar`, `shadow-cta`. Tailwind's defaults (`shadow`, `shadow-sm`, `shadow-lg`) keep working since names don't collide.

### 6. Animation primitives

**Easings (CSS variables in `@theme inline`):**

```css
--ease-out:    cubic-bezier(0.22, 1, 0.36, 1);     /* default suave */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);  /* bounce sutil */
```

**Durations (semantic tokens in `@theme inline`):**

```css
--duration-fast:   180ms;  /* hovers, button states */
--duration-normal: 220ms;  /* toggles */
--duration-medium: 280ms;  /* card state changes */
--duration-slow:   350ms;  /* drawers, expand panels */
```

**Utilities autogenerated:** `ease-out`, `ease-spring`, `duration-fast`, `duration-normal`, `duration-medium`, `duration-slow`.

**`prefers-reduced-motion`** — append in `@layer base`:

```css
@layer base {
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
}
```

### 7. Component migration

**Discovery:** `grep -rn "brand-" apps/web/src` to enumerate every existing usage. Expected files based on recent commits include navbar, footer, cuenta layout, and several static pages, but the grep is the source of truth.

**Replacements:**

| Old | New |
|---|---|
| `bg-brand-coral` | `bg-coral` |
| `text-brand-coral` | `text-coral` |
| `bg-brand-cream` | `bg-cream` |
| `text-brand-cream` | `text-cream` |
| `bg-brand-deep-blue` | `bg-navy` |
| `text-brand-deep-blue` | `text-navy` |
| `bg-brand-sky` | `bg-sky` |
| `text-brand-sky` | `text-sky` |

After all replacements, `grep -rn "brand-" apps/web/src` must return empty.

**Visual diff awareness (sanity-check during smoke test):**

- `cream` and `coral` shifts are imperceptible (sub-2% perceptual difference).
- `navy` is significantly darker than the old `brand-deep-blue` (`oklch(0.42 0.10 250)` ≈ medium blue-purple). Where `brand-deep-blue` was used for body text, the new `navy` improves legibility — verify nothing looked intentionally muted.
- `sky` is more saturated than the old `brand-sky` (`oklch(0.72 0.08 240)` ≈ pale washed). Where `brand-sky` was used as a fill or accent, the new color is more vivid — verify it doesn't fight the layout.

If any single migration looks wrong, fall back to `sky-light` (pale variant) or `navy-light` (medium variant) instead of bare `sky` / `navy`.

---

## Testing

No automated tests in this plan. Validation:

- `cd apps/web && bunx tsc --noEmit` passes.
- `bun run --filter @novapatch/web dev` starts cleanly.
- Visual smoke checklist (manual):
  - [ ] `/mx` loads, no console errors, `<body>` font-family computed shows "Outfit".
  - [ ] `/mx/nosotros` headings render with the new type scale (visibly larger displays with tighter tracking).
  - [ ] `/mx/cuenta` after sign-in renders without color regressions (cream bg, navbar, footer).
  - [ ] `/mx/influencers` renders the cream surface + cards.
  - [ ] DevTools → Rendering → Emulate `prefers-reduced-motion: reduce` → animations stop / shorten to 0.01ms.
  - [ ] DevTools → Computed style on a `text-display-xl` element shows letter-spacing -0.035em and line-height 0.98.
  - [ ] DevTools → Computed on a `bg-coral` element shows the OKLCH or its sRGB equivalent close to `#E8503A`.
- `grep -rn "brand-" apps/web/src` returns empty.

---

## Out-of-Scope Follow-ups

- `nc-descend` keyframe (Plan #9, with Absorption section).
- Hero auto-rotation logic (Plan #9).
- Plan Builder expand/collapse (Plan #7).
- Custom Button / Card / StatChip / FrequencySelector / Eyebrow components (later, when their context is real).
- `/dev/design-system` page showcasing every token (small follow-up plan if useful).
- Dark-mode token coverage matching DESIGN (DESIGN does not specify dark; add only when needed).
- More granular `box-shadow` levels (DESIGN's 5 covers the documented use cases; extend on demand).
- Letter-spacing utilities for non-display text (DESIGN keeps body normal, no token needed).
