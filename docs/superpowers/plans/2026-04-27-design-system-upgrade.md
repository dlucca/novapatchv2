# Design System Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the foundational DESIGN doc tokens (fonts, color, type scale, radii, shadows, animation primitives) to `apps/web` via Tailwind v4 `@theme inline` in `globals.css`, and migrate all existing `brand-*` class usages to the new naming.

**Architecture:** All token edits happen in a single CSS file (`apps/web/src/app/globals.css`). Fonts load via `next/font/google` from a new `lib/fonts.ts`. Component migrations are mechanical class renames across 11 files. No tests — validation is type-check + visual smoke (the file is pure CSS + class strings).

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4 (`@theme inline`), `next/font/google`, OKLCH color space.

**Spec:** [`docs/superpowers/specs/2026-04-27-design-system-upgrade-design.md`](../specs/2026-04-27-design-system-upgrade-design.md)

---

## File map

### Created

| File | Responsibility |
|---|---|
| `apps/web/src/lib/fonts.ts` | `next/font/google` config for Outfit + Newsreader. Exports each font's CSS-variable wrapper. |

### Modified

| File | Change |
|---|---|
| `apps/web/src/app/[locale]/layout.tsx` | Apply `${outfit.variable} ${newsreader.variable}` to the `<html>` element. |
| `apps/web/src/app/globals.css` | (1) drop legacy `--color-brand-*` tokens; (2) add full brand color set + 6 product triads; (3) add type scale; (4) add DESIGN radii + shadows; (5) add easings + duration tokens; (6) add `prefers-reduced-motion` rule in `@layer base`. |
| `apps/web/src/components/site/navbar.tsx` | Rename `brand-*` classes. |
| `apps/web/src/components/site/footer.tsx` | Rename `brand-*` classes. |
| `apps/web/src/app/[locale]/nosotros/page.tsx` | Rename `brand-*` classes. |
| `apps/web/src/app/[locale]/garantia/page.tsx` | Rename `brand-*` classes. |
| `apps/web/src/app/[locale]/faq/page.tsx` | Rename `brand-*` classes. |
| `apps/web/src/app/[locale]/suscripciones/page.tsx` | Rename `brand-*` classes. |
| `apps/web/src/app/[locale]/privacidad/page.tsx` | Rename `brand-*` classes. |
| `apps/web/src/app/[locale]/terminos/page.tsx` | Rename `brand-*` classes. |
| `apps/web/src/app/[locale]/terminos-influencers/page.tsx` | Rename `brand-*` classes. |
| `apps/web/src/app/[locale]/influencers/page.tsx` | Rename `brand-*` classes. |
| `apps/web/src/app/[locale]/influencers/aplicar/page.tsx` | Rename `brand-*` classes. |

---

## Task 1: Load Outfit + Newsreader via `next/font/google`

**Files:**
- Create: `apps/web/src/lib/fonts.ts`
- Modify: `apps/web/src/app/[locale]/layout.tsx`

- [ ] **Step 1: Create the fonts module**

`apps/web/src/lib/fonts.ts`:

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

- [ ] **Step 2: Wire fonts into the locale layout**

Open `apps/web/src/app/[locale]/layout.tsx`. Add the import near the top (after the existing imports):

```ts
import { outfit, newsreader } from "@/lib/fonts";
```

Find the `<html lang={locale}>` element. Change it to:

```tsx
<html lang={locale} className={`${outfit.variable} ${newsreader.variable}`}>
```

- [ ] **Step 3: Verify the fonts load**

Run: `cd apps/web && bun run dev`

Open `http://localhost:3000/mx` in a browser. Open DevTools → Network → filter by "Font". Expected: `outfit-latin-*.woff2` and `newsreader-latin-*.woff2` files load with HTTP 200.

Open DevTools → Elements → click on `<body>` → Computed → `font-family` should currently still be `system-ui, -apple-system, sans-serif` (set by globals.css). That's expected — Task 2 hooks the font tokens into Tailwind's `--font-sans`, which makes `body` switch to Outfit.

- [ ] **Step 4: Type-check**

Run: `cd apps/web && bunx tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/fonts.ts apps/web/src/app/\[locale\]/layout.tsx
git commit -m "feat(web): load Outfit + Newsreader via next/font/google

Outfit: 400/500/600/700/800/900 (full body+display range used by DESIGN).
Newsreader: 400-italic + 600-italic (editorial accents in <em>).
Both registered as CSS variables (--font-outfit, --font-newsreader) on the
<html> element. globals.css will consume them as Tailwind --font-sans /
--font-display / --font-editorial in the next commit."
```

---

## Task 2: Color tokens (drop legacy + add full set + product triads)

**Files:**
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Replace the brand block with the full DESIGN color set**

Open `apps/web/src/app/globals.css`. Find this block (currently lines ~73-77 inside `@theme inline`):

```css
  /* Brand — ported from novafrontend */
  --color-brand-coral: oklch(0.65 0.23 30);
  --color-brand-deep-blue: oklch(0.42 0.10 250);
  --color-brand-sky: oklch(0.72 0.08 240);
  --color-brand-cream: oklch(0.97 0.01 90);
}
```

Replace those 4 lines (keeping the closing `}`) with the full DESIGN tokens. The end of the `@theme inline` block becomes:

```css
  /* === Brand color tokens (DESIGN section 2) === */
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

  /* === Surfaces === */
  --color-cream:   oklch(0.98 0.01 70);     /* #FAF7F2 — bg principal */
  --color-warm:    oklch(0.98 0.02 70);     /* #FEF7ED */
  --color-blush:   oklch(0.96 0.01 25);     /* #F8EDEB — footer, La ciencia */
  --color-surface: oklch(0.98 0 0);         /* #FAFAFA */

  /* === Per-product triads (DESIGN section 2.3) === */
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

  /* === Font tokens (consumed via next/font CSS variables on <html>) === */
  --font-display:   var(--font-outfit);
  --font-editorial: var(--font-newsreader);
  --font-sans:      var(--font-outfit);
}
```

- [ ] **Step 2: Verify the existing `body` rule still works**

Look at `@layer base` near the bottom of the file. The current rule is:

```css
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

Remove the explicit `font-family: system-ui, -apple-system, sans-serif;` line so `body` falls back to Tailwind's `--font-sans` (= Outfit). The result:

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground font-sans;
  }
}
```

- [ ] **Step 3: Smoke test**

Run: `cd apps/web && bun run dev` (if not already running). Open `http://localhost:3000/mx`.

Expected: the page loads. The text is now in Outfit (DevTools → Computed → `font-family` on `<body>` → starts with `__className_<hash>` and resolves to "Outfit"). Existing pages that use `brand-*` classes will look BROKEN at this point (e.g. `bg-brand-cream` on `/mx/nosotros` becomes a class with no rule, so the section has the default white background). That's expected — the migration in Task 6 fixes them.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(web): full DESIGN color tokens + 6 product triads + font hookup

Drops legacy --color-brand-coral/-deep-blue/-sky/-cream. Adds the full
DESIGN brand palette (coral/navy/ocean/sky/teal/gold/lime + light/dark
variants), surface tokens (cream/warm/blush/surface), and 6 per-product
color triads (accent/ink/bg). Hooks --font-sans / --font-display /
--font-editorial to the next/font CSS variables.

Existing brand-* class usages will look broken until Task 6 migration."
```

---

## Task 3: Type scale tokens

**Files:**
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Append type scale tokens to `@theme inline`**

Open `apps/web/src/app/globals.css`. After the `--font-display / --font-editorial / --font-sans` lines you added in Task 2, but BEFORE the closing `}` of the `@theme inline` block, append the type scale:

```css
  /* === Type scale (DESIGN section 3) === */
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

  /* Eyebrow (uppercase label sobre h2 — consumer adds .uppercase) */
  --text-eyebrow: 11px;
  --text-eyebrow--line-height: 1.2;
  --text-eyebrow--letter-spacing: 0.18em;
  --text-eyebrow--font-weight: 700;
```

- [ ] **Step 2: Smoke test**

Reload `http://localhost:3000/mx` in the browser. The page renders. Open DevTools → Elements → inspect any `<h1>` or `<h2>`. Note that text-* utilities like `text-display-xl` are now available but no element uses them yet — they'll be picked up when components are upgraded in later plans.

To verify the tokens work, in DevTools → Console run:

```js
const probe = document.createElement('h1');
probe.className = 'text-display-xl';
probe.textContent = 'PROBE';
document.body.appendChild(probe);
const style = getComputedStyle(probe);
console.log({
  fontSize: style.fontSize,
  lineHeight: style.lineHeight,
  letterSpacing: style.letterSpacing,
  fontWeight: style.fontWeight,
});
probe.remove();
```

Expected output (approximate, depending on viewport width because of the `clamp`):

```
{ fontSize: "<between 48px and 72px>", lineHeight: "<≈0.98>", letterSpacing: "<-0.035em equiv>", fontWeight: "900" }
```

If `fontSize` is `48px` exactly with no variation in a wide viewport, the `clamp()` is being interpreted incorrectly — re-check the syntax. Otherwise looks good.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(web): type scale tokens (display/body/eyebrow) per DESIGN section 3

Tailwind v4 tuple syntax binds line-height, letter-spacing, and font-weight
to each text utility. Display sizes use clamp() for fluid scaling.
Utilities autogenerated: text-display-xl/lg/md/sm, text-h3/h4,
text-body-lg/body/-sm, text-caption, text-eyebrow."
```

---

## Task 4: Radii + Shadows

**Files:**
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Replace the radii block with DESIGN values**

In `apps/web/src/app/globals.css`, find the existing radii inside `@theme inline` (currently lines ~52-55):

```css
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
```

Replace those 4 lines with the DESIGN scale (7 entries):

```css
  /* === Radii (DESIGN section 5) === */
  --radius-sm:   8px;     /* badges pequeños, chips */
  --radius-md:   12px;    /* cards de items en lists */
  --radius-lg:   16px;    /* cards medianas, inputs, stat chips */
  --radius-xl:   18px;    /* legend cards, info boxes */
  --radius-2xl:  22px;    /* containers de sección, dropdowns */
  --radius-3xl:  24px;    /* cards principales, plan summary */
  --radius-full: 9999px;  /* pills, buttons, dots */
```

The `--radius: 0.625rem` in `:root` becomes orphaned but harmless (no consumer reads it now). Leave it alone — removing might confuse Drizzle/shadcn migration tooling later.

- [ ] **Step 2: Append shadows in `@theme inline`**

After the type scale tokens (Task 3 step 1), but BEFORE the closing `}` of `@theme inline`, append:

```css
  /* === Shadows (DESIGN section 6) === */
  --shadow-card:        0 4px 14px rgb(13 27 53 / 0.04);   /* neutral cards */
  --shadow-card-active: 0 12px 32px rgb(13 27 53 / 0.08);  /* hover / selected */
  --shadow-card-hero:   0 16px 44px rgb(13 27 53 / 0.10);  /* highlighted */
  --shadow-bar:         0 24px 64px rgb(13 27 53 / 0.32);  /* floating bottom bar */
  --shadow-cta:         0 10px 24px rgb(232 80 58 / 0.4);  /* coral CTAs */
```

- [ ] **Step 3: Smoke test**

Reload `http://localhost:3000/mx`. shadcn components (button, card, sheet) should still render without visual breakage; corners are now 8/12/16/18px instead of the old shadcn-derived 6/8/10/14px. Most differences are imperceptible on small components — the slight variation is documented in the spec and acceptable.

In DevTools → Console, probe a shadow utility:

```js
const probe = document.createElement('div');
probe.className = 'shadow-cta';
document.body.appendChild(probe);
console.log(getComputedStyle(probe).boxShadow);
probe.remove();
```

Expected: a non-empty string containing `rgb(232 80 58 / 0.4)` or its computed-form equivalent (e.g. `rgba(232, 80, 58, 0.4)`).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(web): radii + shadows per DESIGN sections 5 and 6

Radii: sm 8px, md 12px, lg 16px, xl 18px, 2xl 22px, 3xl 24px, full pill.
Replaces the shadcn-derived calc-based radii. The :root --radius anchor
is left in place but orphaned; removing it would risk shadcn tooling
churn.

Shadows: shadow-card / -active / -hero / -bar / -cta utilities for
neutral cards, hover/active state, hero/plan-summary highlight, floating
bottom bar, and coral CTAs."
```

---

## Task 5: Animation primitives + reduced-motion

**Files:**
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Append easings + durations to `@theme inline`**

After the shadows block from Task 4, BEFORE the closing `}` of `@theme inline`, append:

```css
  /* === Animation primitives (DESIGN sections 8.1, 8.2) === */
  --ease-out:    cubic-bezier(0.22, 1, 0.36, 1);     /* default suave */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);  /* bounce sutil */

  --duration-fast:   180ms;  /* hovers, button states */
  --duration-normal: 220ms;  /* toggles */
  --duration-medium: 280ms;  /* card state changes */
  --duration-slow:   350ms;  /* drawers, expand panels */
```

- [ ] **Step 2: Add the `prefers-reduced-motion` rule in `@layer base`**

Find the existing `@layer base` block at the bottom of the file. Append a new media query at the end of that layer, after the existing `body` rule:

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground font-sans;
  }

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

- [ ] **Step 3: Smoke test**

Reload `http://localhost:3000/mx`. In DevTools → Rendering → `Emulate CSS media feature prefers-reduced-motion` → set to `reduce`. Hover over any button or interactive element with a transition. Expected: transitions complete instantly (the 0.01ms override).

In DevTools → Console, probe duration tokens:

```js
const probe = document.createElement('div');
probe.className = 'duration-medium';
document.body.appendChild(probe);
console.log(getComputedStyle(probe).transitionDuration);
probe.remove();
```

Expected: `0.28s` (= 280ms).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(web): animation primitives (easings + durations) + reduced-motion

Easings: --ease-out (cubic-bezier 0.22,1,0.36,1) for default smooth,
--ease-spring (cubic-bezier 0.34,1.56,0.64,1) for bounce.
Durations: fast 180ms, normal 220ms, medium 280ms, slow 350ms.
prefers-reduced-motion rule globally collapses animations to 0.01ms.

nc-descend keyframe and component-specific animations defer to Plan #9
(Home / Absorption) and Plan #7 (Plan Builder) where their use is concrete."
```

---

## Task 6: Migrate `brand-*` class usages across components

**Files (all modify):**
- `apps/web/src/components/site/navbar.tsx`
- `apps/web/src/components/site/footer.tsx`
- `apps/web/src/app/[locale]/nosotros/page.tsx`
- `apps/web/src/app/[locale]/garantia/page.tsx`
- `apps/web/src/app/[locale]/faq/page.tsx`
- `apps/web/src/app/[locale]/suscripciones/page.tsx`
- `apps/web/src/app/[locale]/privacidad/page.tsx`
- `apps/web/src/app/[locale]/terminos/page.tsx`
- `apps/web/src/app/[locale]/terminos-influencers/page.tsx`
- `apps/web/src/app/[locale]/influencers/page.tsx`
- `apps/web/src/app/[locale]/influencers/aplicar/page.tsx`

- [ ] **Step 1: Confirm the discovery list**

Run: `grep -rln "brand-" apps/web/src | grep -v globals.css`

Expected: the 11 files above. If the grep returns more or fewer, update the migration to match the actual list. If `globals.css` shows up (after your Task 2 commit it should not — Task 2 dropped the legacy tokens), that's a missed cleanup; remove the orphaned tokens.

- [ ] **Step 2: Apply the rename mapping**

The mapping is purely string-based. Apply it to every file in the list:

| Old | New |
|---|---|
| `bg-brand-coral` | `bg-coral` |
| `text-brand-coral` | `text-coral` |
| `border-brand-coral` | `border-coral` |
| `hover:bg-brand-coral` | `hover:bg-coral` |
| `bg-brand-coral/90` | `bg-coral/90` |
| `bg-brand-cream` | `bg-cream` |
| `text-brand-cream` | `text-cream` |
| `bg-brand-deep-blue` | `bg-navy` |
| `text-brand-deep-blue` | `text-navy` |
| `border-brand-deep-blue` | `border-navy` |
| `bg-brand-sky` | `bg-sky` |
| `text-brand-sky` | `text-sky` |

Use a one-shot `sed` per file or your editor's project-wide find-and-replace. If using sed (macOS):

```bash
for f in apps/web/src/components/site/navbar.tsx \
         apps/web/src/components/site/footer.tsx \
         apps/web/src/app/\[locale\]/nosotros/page.tsx \
         apps/web/src/app/\[locale\]/garantia/page.tsx \
         apps/web/src/app/\[locale\]/faq/page.tsx \
         apps/web/src/app/\[locale\]/suscripciones/page.tsx \
         apps/web/src/app/\[locale\]/privacidad/page.tsx \
         apps/web/src/app/\[locale\]/terminos/page.tsx \
         apps/web/src/app/\[locale\]/terminos-influencers/page.tsx \
         apps/web/src/app/\[locale\]/influencers/page.tsx \
         apps/web/src/app/\[locale\]/influencers/aplicar/page.tsx; do
  sed -i '' \
    -e 's/brand-coral/coral/g' \
    -e 's/brand-cream/cream/g' \
    -e 's/brand-deep-blue/navy/g' \
    -e 's/brand-sky/sky/g' \
    "$f"
done
```

The four `sed -e` rules cover every variant (with or without prefixes like `text-`, `bg-`, `border-`, `hover:`, opacity suffixes like `/90`).

- [ ] **Step 3: Verify the cleanup is complete**

Run: `grep -rn "brand-" apps/web/src`

Expected: empty output. If any line remains, inspect and fix manually. (Possible stragglers: `brand-` inside a comment, or in i18n message keys like `brand.title`. Those are fine — leave them. Reject only Tailwind class strings like `text-brand-X`.)

To distinguish, narrow the grep to JSX class strings:

```bash
grep -rn 'class[Nn]ame=.*brand-' apps/web/src
```

Expected: empty.

- [ ] **Step 4: Type-check**

Run: `cd apps/web && bunx tsc --noEmit`

Expected: PASS. (Class-string changes don't affect TS, but the type-check protects against accidental typos in non-string code.)

- [ ] **Step 5: Visual smoke test**

If `bun run dev` is not running, start it: `cd apps/web && bun run dev`.

Open each of these URLs in a browser and verify visually:

- [ ] `http://localhost:3000/mx` (home — currently the landing card; should render with cream bg)
- [ ] `http://localhost:3000/mx/nosotros` — cream bg, eyebrow text in coral, h1 in navy
- [ ] `http://localhost:3000/mx/garantia` — same pattern
- [ ] `http://localhost:3000/mx/faq` — accordion renders, navy headings
- [ ] `http://localhost:3000/mx/suscripciones` — feature cards
- [ ] `http://localhost:3000/mx/privacidad` — long form text in navy
- [ ] `http://localhost:3000/mx/terminos` — same
- [ ] `http://localhost:3000/mx/terminos-influencers` — same
- [ ] `http://localhost:3000/mx/influencers` — three cards, coral CTA button at bottom
- [ ] `http://localhost:3000/mx/influencers/aplicar` — "Próximamente" stub

Expected differences from the previous look (these are improvements, not bugs):

- **Navy text is darker** than the old `brand-deep-blue` (which was a medium blue-gray). Headings now have stronger contrast against the cream bg.
- **Coral is slightly more red-orange** vs the previous OKLCH approximation.
- **Cream is virtually identical** (sub-perceptual difference).

If any single migration looks visibly broken (e.g. a navy element that becomes too dark for its context), open the file, find the offending class, and either:
- Replace `text-navy` with `text-navy-light` (medium variant), or
- Replace `bg-sky` with `bg-sky-light` (paler variant).

The fallback variants are intentionally provided in the token set for these cases.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/site/ apps/web/src/app/\[locale\]/
git commit -m "refactor(web): migrate brand-* class usages to DESIGN names

Mechanical rename across 11 files (navbar, footer, 9 static pages):
  brand-coral     → coral
  brand-cream     → cream
  brand-deep-blue → navy
  brand-sky       → sky

Visual diffs are intentional improvements per DESIGN: navy is darker
(better contrast on body text), sky more saturated, coral slightly
more red-orange. No semantic UI changes."
```

---

## Task 7: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Full grep for stragglers**

```bash
grep -rn 'class[Nn]ame=.*brand-' apps/web/src
grep -rn 'brand-' apps/web/src/app/globals.css
```

Both should return empty.

- [ ] **Step 2: Type-check the whole web app**

```bash
cd apps/web && bunx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: API tests still pass (sanity check that nothing leaked across apps)**

```bash
cd apps/api && bun test 2>&1 | tail -3
```

Expected: 185 pass / 0 fail (unchanged from main).

- [ ] **Step 4: Final visual smoke**

If dev server isn't running, start it. Spot-check these URLs in a fresh browser tab (cache-bust with Cmd+Shift+R):

- `http://localhost:3000/mx`
- `http://localhost:3000/mx/nosotros`
- `http://localhost:3000/mx/cuenta` (after sign-in)
- `http://localhost:3000/mx/influencers`

For each:
- [ ] No console errors (DevTools → Console, hard reload).
- [ ] `<body>` font-family is Outfit (DevTools → Computed).
- [ ] Coral CTAs render with the new color.
- [ ] Navbar + Footer match the new cream surface.
- [ ] No `text-brand-X` stragglers visible as unstyled text.

- [ ] **Step 5: Verify `prefers-reduced-motion`**

DevTools → Rendering → `Emulate CSS media feature prefers-reduced-motion` → `reduce`. Hover over any link or button. Expected: transitions are essentially instant.

Reset to `no-preference`. Hover again. Expected: transitions return to their normal duration.

- [ ] **Step 6: No commit needed for Task 7**

This task is verification only. If any of the steps above reveal a regression, fix it inline and commit as `fix(web): post-migration nit — <description>`.
