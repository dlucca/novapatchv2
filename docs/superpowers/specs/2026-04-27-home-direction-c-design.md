# Home (Direction C) Design Spec

**Date:** 2026-04-27
**Branch:** `home-direction-c`
**Source design:** Claude Design bundle `7vCw9ECPFQeLVXSvBu2twQ` — `Home Directions.html` composing `DirectionC` (Hero+Uso from B · La ciencia (rediseñada) · Comparativa+Grid from A · SubscriptionTeaser · FinalCTA · Footer).
**Roadmap shift:** This plan **replaces the original Plan #4** (Tienda + Cart drawer + PDP). Tienda + PDP become a follow-up Plan #4b. Cart store + drawer move into this plan because the Home cards have an "Agregar" button that needs a real bag.

## Goal

Ship the `/[locale]` homepage as the brand's first end-to-end conversion-oriented surface: editorial hero with patch selector, "Uso diario" with lifestyle photo, animated absorption diagram, comparison vs pills/gummies, 6-product grid with one-time add-to-bag, subscription teaser, final CTA. Includes a minimal Zustand+localStorage cart store + drawer that the grid wires into. No checkout (Plan #5 introduces Stripe; Plan #6 wires checkout). No subscription cart (subscription line items wait until Plan Builder = Plan #7).

## Non-goals

- Tienda page, PDP routes — Plan #4b
- Plan Builder UI — Plan #7
- Stripe integration / checkout — Plans #5–6
- Subscription cart line items — Plan #7
- Quiz, FAQ section, testimonials, trust strip (none of these are in DirectionC)
- Admin views — Plans #10/11
- Visual regression / Lighthouse budgets enforced in CI (manual verification this plan)

## Brainstorming decisions (locked)

| # | Question | Decision |
|---|---|---|
| Q1 | Scope | (A) Full pixel-perfect, all animations |
| Q2 | Nav strategy | (C) Reuse existing Navbar from Plans #2/#3 with a `variant="transparent"` mode applied only on home |
| Q3 | "Agregar" wiring | (B) Implement minimal cart store + drawer in this plan |
| Q4 | Typography for italic spans | (B) Newsreader italic per Plan #2 design system (overrides prototype's Outfit italic) |
| Q5 | CTAs to non-existent pages | (C) Change copy where there is no destination; nav links use anchor scroll; footer links are visually deemphasized + `aria-disabled` |
| Q6 | Pricing in hero CTA vs cards | (A) All home shows retail $750 once. Subscription discounts only inside `SubscriptionTeaser` |
| Q7 | i18n | (A) Full i18n under `pages.home.*` in `messages/es.json` (~90 keys) |
| Q8 | Animations / reduced-motion | (A) Trust Plan #2's `prefers-reduced-motion` CSS rule, plus a JS check in the hero `useEffect` to skip the auto-rotation `setInterval` |
| Q9 | Mobile responsiveness | **Mobile-first** baseline 375px → enhances to 1280px. Comparison table becomes 3 stacked cards on mobile. Grid 1/2/3 cols. Hero stacks vertical with horizontal-scroll-snap selector |
| Q10 | Assets | (A) Copy 7 webp files from the design bundle directly into `apps/web/public/products/` |
| Newsletter | — | Footer newsletter wires to `POST /waitlist` with `source: "footer"`, prefilling `country` from cookie |
| Subscription teaser CTA | — | Copy changes from "Arma tu plan" to "Suscríbete y ahorra"; href smooth-scrolls to `#productos` until Plan #7 |
| Subscription discounts | — | **20% / 15% / 10%** (PRD-aligned), overriding prototype's 15/10/5 |

## Architecture

### Component tree

```
app/[locale]/page.tsx                 (Server, getTranslations + composes)
└── <Navbar variant="transparent" />  (Client, existing component + new prop)
└── <Hero />                          (Client — selector, animations, color-shift)
└── <HowItWorks />                    (Client — minimal interactivity, lifestyle photo)
└── <Absorption />                    (Client — animated dots SVG diagram)
└── <Comparison />                    (Server — static table desktop + cards mobile)
└── <ProductGrid />                   (Client — addItem, hover, openDrawer)
└── <SubscriptionTeaser />            (Server — static)
└── <FinalCTA />                      (Client — scroll-to handler)
└── <Footer />                        (Client — newsletter form, replaces existing Footer)
└── <CartDrawer />                    (Client — mounted at root, controlled by store)
└── <CountryGate />                   (Client — already in layout from Plan #3)
```

### File layout

```
apps/web/
├── public/products/
│   ├── Energy.webp · Sleep.webp · Glow.webp · Shield.webp · Zen.webp · Woman.webp
│   └── lifestyle-apply.webp
├── src/
│   ├── app/[locale]/
│   │   ├── layout.tsx                  # MODIFY — mount <CartDrawer/>
│   │   └── page.tsx                    # REWRITE — compose home sections
│   ├── components/site/
│   │   ├── navbar.tsx                  # MODIFY — variant prop + cart button
│   │   └── footer.tsx                  # REWRITE — FooterC layout + newsletter
│   ├── components/home/
│   │   ├── hero.tsx
│   │   ├── how-it-works.tsx
│   │   ├── absorption.tsx
│   │   ├── comparison.tsx
│   │   ├── product-grid.tsx
│   │   ├── subscription-teaser.tsx
│   │   └── final-cta.tsx
│   ├── components/cart/
│   │   ├── cart-store.ts               # Zustand + persist middleware
│   │   ├── cart-drawer.tsx             # shadcn Sheet content
│   │   └── cart-button.tsx             # nav button with badge
│   ├── lib/
│   │   ├── products.ts                 # NOVA_PRODUCTS data, typed
│   │   └── home-anchors.ts             # smooth scroll helper
│   └── messages/
│       └── es.json                     # MODIFY — add pages.home.*, components.cart, update components.footer/navbar
```

### Tests

```
apps/web/test/
├── unit/cart-store.test.ts
├── components/home/hero.test.tsx
├── components/home/product-grid.test.tsx
├── components/home/comparison.test.tsx
├── components/cart/cart-drawer.test.tsx
├── components/site/navbar.test.tsx
├── components/site/footer.test.tsx
└── e2e/home-cart.spec.ts                # Playwright happy-path
```

## Data model

### Products (`lib/products.ts`)

```ts
export type ProductMeta = {
  slug: "energy" | "sleep" | "glow" | "shield" | "zen" | "woman";
  name: string;
  image: string;        // /products/Glow.webp (public path)
  tagline: string;
  quote: string;
  color: string;        // accent
  ink: string;          // dark variant
  bg: string;           // pale background
  popular?: boolean;
  ingredients: string[];
  tags: string[];
};

export const NOVA_PRODUCTS: ProductMeta[] = [/* 6 entries from design data.jsx, image paths rewritten */];

export const RETAIL_PRICE = 750;     // MXN, per PRD
export const SUB_DISCOUNTS = { 30: 0.20, 60: 0.15, 90: 0.10 } as const;
```

(Tagline, quote, ingredients are Spanish editorial copy stored in this file, not in i18n. Decision Q7 limited i18n to UI chrome.)

### Cart store (`components/cart/cart-store.ts`)

```ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ProductMeta } from "@/lib/products";

export type CartItem = {
  slug: string;
  name: string;
  price: number;        // MXN unit
  qty: number;
  color: string;
  ink: string;
  image: string;
};

type CartState = {
  items: CartItem[];
  drawerOpen: boolean;
  hydrated: boolean;
  addItem: (p: ProductMeta, price: number) => void;
  removeItem: (slug: string) => void;
  setQty: (slug: string, qty: number) => void;
  clear: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      drawerOpen: false,
      hydrated: false,
      addItem: (p, price) =>
        set((s) => {
          const ex = s.items.find((i) => i.slug === p.slug);
          if (ex) {
            return {
              items: s.items.map((i) =>
                i.slug === p.slug ? { ...i, qty: i.qty + 1 } : i,
              ),
            };
          }
          return {
            items: [
              ...s.items,
              { slug: p.slug, name: p.name, price, qty: 1, color: p.color, ink: p.ink, image: p.image },
            ],
          };
        }),
      removeItem: (slug) =>
        set((s) => ({ items: s.items.filter((i) => i.slug !== slug) })),
      setQty: (slug, qty) =>
        set((s) => ({
          items:
            qty <= 0
              ? s.items.filter((i) => i.slug !== slug)
              : s.items.map((i) => (i.slug === slug ? { ...i, qty } : i)),
        })),
      clear: () => set({ items: [] }),
      openDrawer: () => set({ drawerOpen: true }),
      closeDrawer: () => set({ drawerOpen: false }),
    }),
    {
      name: "novapatch.cart.v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ items: s.items }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);

export const cartCount = (items: CartItem[]) => items.reduce((s, i) => s + i.qty, 0);
export const cartTotal = (items: CartItem[]) => items.reduce((s, i) => s + i.price * i.qty, 0);
```

Hydration safety pattern in consumers:

```tsx
const items = useCart((s) => s.items);
const hydrated = useCart((s) => s.hydrated);
const count = hydrated ? cartCount(items) : 0;
```

## Sections

### 1. Hero (`components/home/hero.tsx`)

**Layout**

- Mobile (<1024px): vertical stack — image with halo + orbiting ingredients on top (h:280px, ingredients reposition 2 above + 2 below the patch instead of orbiting), copy + CTAs below, selector at bottom as horizontal-scroll-snap row.
- Desktop (≥1024px): split `1fr 1fr`, copy left, floating product right with 4 orbiting ingredient chips (radius 220px), selector centered below.

**Background**

- `linear-gradient(160deg, ${selectedProduct.ink} 0%, var(--navy) 75%)` with `transition: background 700ms cubic-bezier(0.22,1,0.36,1)`.
- Ambient glow: `radial-gradient(900px 600px at 75% 40%, ${selectedProduct.color}55, transparent 60%)`.
- SVG turbulence noise overlay at `mixBlendMode: overlay, opacity: 0.3`.

**State + animations**

```tsx
const [selected, setSelected] = useState(2); // Glow default (popular)
const [paused, setPaused] = useState(false);

useEffect(() => {
  if (paused) return;
  if (typeof window === "undefined") return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;
  const id = setInterval(() => setSelected((s) => (s + 1) % 6), 5500);
  return () => clearInterval(id);
}, [paused]);

const handleSelect = (i: number) => { setPaused(true); setSelected(i); };
```

- Halo pulse: `@keyframes pulseHaloB` 4s loop, scale 1 → 1.06.
- Float patch: `@keyframes floatPatchB` 5s loop, translateY -14px + slight rotation.
- Both keyframes are CSS — Plan #2's `prefers-reduced-motion` rule reduces them to 0.01ms.

**Typography**

- H1: 3 lines: "Bienestar" / "*que se pega*" / "a tu día." Italic span uses `<span className="font-newsreader italic font-normal">` (Plan #2's design system).
- Mobile: `clamp(40px, 11vw, 56px)`. Desktop: `clamp(64px, 6.5vw, 86px)`.
- Italic span color = `selectedProduct.color`, transitions with the rest of the hero.

**CTAs**

- Primary: "Agregar `{name}` · $750" (retail price per Q6) → `useCart.addItem(selected, 750)` + `openDrawer()`.
- Secondary: "Ver ingredientes" → smooth scroll to `#productos`.

**i18n keys (`pages.home.hero`)**

```json
{
  "pill": "Parche del momento · {name}",
  "title_a": "Bienestar",
  "title_b_italic": "que se pega",
  "title_c": "a tu día.",
  "cta_primary": "Agregar {name} · ${price}",
  "cta_secondary": "Ver ingredientes",
  "formula_label": "Fórmula",
  "selector_label": "Elige el parche · descubre su fórmula"
}
```

**Accessibility**

- Selector buttons: `aria-pressed={i === selected}`, `aria-label="Mostrar parche {name}"`.
- Halo + float decoration: `aria-hidden="true"`.
- Auto-rotation also pauses on `focus` within the hero (handled in `paused` setter).

### 2. HowItWorks (`components/home/how-it-works.tsx`)

**Layout**

- Mobile: stack — eyebrow + title + lead, then 3 step cards stacked, then lifestyle photo at bottom.
- Desktop (≥1024px): split `1fr 1.05fr`, copy + 3 step cards left, lifestyle photo right.

**Steps (data inline in component)**

```ts
const STEPS = [
  { n: "01", t: "Pega",  d: "Una vez al día en piel limpia. Discreto y sin olor.", color: "var(--coral)" },
  { n: "02", t: "Olvida", d: "Libera vitaminas 10–12h. Sin horarios, sin picos.",  color: "var(--teal)"  },
  { n: "03", t: "Vive",   d: "Tu día no para. Tu bienestar tampoco.",              color: "var(--gold)"  },
];
```

(Strings come from i18n; the `color` token references Plan #2 CSS vars.)

**Lifestyle photo**

```tsx
<Image
  src="/products/lifestyle-apply.webp"
  alt={t("photo_alt")}
  fill
  sizes="(min-width: 1024px) 600px, 100vw"
  className="object-cover"
/>
```

Aspect ratio `1 / 1.15`, `border-radius: 32px`, shadow `0 30px 80px rgba(13,27,53,0.18)`.

**Floating annotations**

- Top-left: white pill with pulsing teal dot — "Aplicación · 3 segundos".
- Bottom-right: navy card with `<Clock/>` icon — "10–12h" + duration label.

Both scaled to 60% on mobile.

**i18n keys (`pages.home.how_it_works`)**

```json
{
  "eyebrow": "Uso diario",
  "title_a": "Pega, olvida",
  "title_b_italic": "y deja que trabaje",
  "lead": "Tres segundos por la mañana. El parche hace el resto durante todo tu día — discreto bajo la ropa, sin olor, sin recordatorios.",
  "steps": {
    "1": { "title": "Pega",   "desc": "Una vez al día en piel limpia. Discreto y sin olor." },
    "2": { "title": "Olvida", "desc": "Libera vitaminas 10–12h. Sin horarios, sin picos." },
    "3": { "title": "Vive",   "desc": "Tu día no para. Tu bienestar tampoco." }
  },
  "annotation_apply": "Aplicación · 3 segundos",
  "duration_label": "Liberación continua mientras vives tu día.",
  "photo_alt": "Persona aplicando un parche Novapatch en el brazo"
}
```

### 3. Absorption (`components/home/absorption.tsx`)

**Layout**

- Mobile: stack — eyebrow + title + lead + 3 stat chips (horizontal scroll-snap, min-width 130px each, gap 12px) + CTA, then SkinDiagramC below.
- Desktop (≥1024px): split `1fr 1.25fr`, copy + chips + CTA left, diagram right.

**Background:** `var(--cream-warm)` (`#FAF0EA`).

**SkinDiagramC**

- Container: `border-radius: 24px`, `background: #EFE0D6`, `padding: 18px`, max-width 580px desktop, 100% mobile.
- Yellow "NOVAPATCH" pill at top with subtitle "Liberación controlada · 10–12 horas".
- 4 stacked SVG bands (heights: corneo 76 / epidermis 92 / dermis 124 / blood 80) with wavy bottoms (path command per design `direction-c.jsx`:212-213). The bloodstream band has 2 arterial-curve SVG paths in coral and dark coral.
- 6 absolute-positioned dots descending from top of stack to inside the bloodstream band, animated with `@keyframes nc-descend-c` 5s linear infinite, lateral positions `[22, 36, 52, 68, 82, 44]%`, delays `[0, 0.6, 1.4, 2.2, 3.1, 4.0]s`.
- Plan #2 reduced-motion CSS reduces dot animation to 0.01ms — they end up frozen near the top, still visible.

**Stat chips (3)**

| Big | Unit | Label |
|---|---|---|
| `<500` | Da | Tamaño molecular |
| `10–12` | h | Absorción sostenida |
| `0` | × | Digestión requerida |

**CTA "Encuentra tu parche"** → smooth scroll to `#productos`.

**i18n keys (`pages.home.absorption`)**

```json
{
  "eyebrow": "La ciencia",
  "title": "No cualquier ingrediente funciona en un parche.",
  "lead": "Para atravesar la piel, un ingrediente necesita tener menos de 500 Daltons de masa molecular. El resultado: absorción directa al torrente sanguíneo, sin pasar por el sistema digestivo, durante entre 10 y 12 horas continuas.",
  "stats": {
    "size":      { "value": "<500",  "unit": "Da", "label": "Tamaño molecular" },
    "duration":  { "value": "10–12", "unit": "h",  "label": "Absorción sostenida" },
    "digestion": { "value": "0",     "unit": "×",  "label": "Digestión requerida" }
  },
  "cta": "Encuentra tu parche",
  "diagram": {
    "novapatch_label": "NOVAPATCH",
    "novapatch_subtitle": "Liberación controlada · 10–12 horas",
    "layers": {
      "corneo": "ESTRATO CÓRNEO",
      "epidermis": "EPIDERMIS",
      "dermis": "DERMIS",
      "blood": "TORRENTE SANGUÍNEO"
    },
    "chip_daltons": "< 500 Daltons"
  }
}
```

### 4. Comparison (`components/home/comparison.tsx`)

**Layout**

- Mobile (<768px): 3 stacked cards. Card 1 (Novapatch winner) `bg: var(--navy), color: white` with coral "NOVAPATCH" badge. Cards 2 & 3 white with subtle border. Each card lists all 6 features as `[label] : [value]` rows.
- Desktop (≥768px): single table grid `1.6fr 1.1fr 1fr 1fr`. Header row + 6 feature rows. Novapatch column shaded with `rgba(248,237,235,0.35)` and the coral "Novapatch" badge floating above. Boolean values render as ✓ (coral disc) or ✗ (gray disc).

**Background:** `var(--cream)` (`#FAF7F2`).

**Rows (data inline)**

| Feature | Novapatch | Cápsulas | Gomitas |
|---|---|---|---|
| Absorción efectiva | 90% | 10–20% | 10–20% |
| Liberación sostenida | 10–12h | 2–4h | 2–4h |
| Sin pasar por el hígado | ✓ | ✗ | ✗ |
| Sin azúcar ni excipientes | ✓ | ✓ | ✗ |
| Sin sabor, sin agua | ✓ | ✗ | ✗ |
| Uso diario sin olvidos | ✓ | ✗ | ✗ |

(Booleans not translated — only labels are.)

**i18n keys (`pages.home.comparison`)**

```json
{
  "eyebrow": "Comparativa",
  "title_a": "¿Pastilla, gomita",
  "title_b_italic": "o parche?",
  "lead": "Lo simple se repite. Lo complejo se abandona.",
  "columns": {
    "novapatch": { "name": "Novapatch", "sub": "Parche transdérmico" },
    "capsules":  { "name": "Cápsulas",  "sub": "Vía oral" },
    "gummies":   { "name": "Gomitas",   "sub": "Vía oral + azúcar" }
  },
  "rows": {
    "absorption":    "Absorción efectiva",
    "release":       "Liberación sostenida",
    "no_liver":      "Sin pasar por el hígado",
    "no_sugar":      "Sin azúcar ni excipientes",
    "no_water":      "Sin sabor, sin agua",
    "no_forgetting": "Uso diario sin olvidos"
  },
  "values": {
    "absorption": ["90%", "10–20%", "10–20%"],
    "release":    ["10–12h", "2–4h", "2–4h"]
  },
  "winner_badge": "Novapatch"
}
```

### 5. ProductGrid (`components/home/product-grid.tsx`)

**Layout**

- Mobile: 1 column.
- Tablet (≥768px): 2 columns.
- Desktop (≥1024px): 3 columns from prototype.

**Card structure**

```
┌── image area ─────────────────────┐
│ aspect 1/1.05                     │
│ radial gradient bg from p.color   │
│ image centered with drop shadow   │
│ [popular badge if p.popular]      │
│ [3 ingredient chips on hover]     │
└───────────────────────────────────┘
┌── info area ──────────────────────┐
│ Name (Outfit 900 26px) [30 u.]    │
│ Tagline                           │
│ ─────────────                     │
│ $750  MXN/mes  [Agregar +]        │
└───────────────────────────────────┘
```

**Hover (desktop only via `@media (hover: hover)`)**

- Card translates up 5px, deeper shadow.
- Image scales 1.05 + rotates -2deg.
- Ingredient chips fade in from 12px below to 0px (3 chips + count if more).

**Click "Agregar"**

```tsx
onClick={() => {
  useCart.getState().addItem(p, RETAIL_PRICE);
  useCart.getState().openDrawer();
}}
```

**Section anchor:** `<section id="productos">` so the smooth-scroll handlers from Hero/Absorption/FinalCTA/Footer all land here.

**i18n keys (`pages.home.product_grid`)**

```json
{
  "eyebrow": "Elige el tuyo",
  "title_a": "Seis parches,",
  "title_b_italic": "un bienestar para cada día",
  "card": {
    "units_short": "30 u.",
    "price_per_month": "MXN / mes",
    "add": "Agregar",
    "popular": "Popular"
  }
}
```

### 6. SubscriptionTeaser (`components/home/subscription-teaser.tsx`)

**Layout**

- Mobile: stacked — copy block then frequency tier rows.
- Desktop (≥1024px): split `1.1fr 1fr` inside a navy gradient card with decorative radial glows.

**Frequency tiers (data)**

```ts
const FREQ_TIERS = [
  { days: 30, off: 20, color: "var(--teal)",   tag_key: "tier_high" },
  { days: 60, off: 15, color: "var(--sky)",    tag_key: "tier_balanced" },
  { days: 90, off: 10, color: "var(--gold)",   tag_key: "tier_trial" },
];
```

(Discounts 20/15/10 per PRD — overrides prototype's 15/10/5.)

**CTA**

- Copy: "Suscríbete y ahorra" (per Q5).
- Action: smooth scroll to `#productos`.

**i18n keys (`pages.home.subscription_teaser`)**

```json
{
  "eyebrow": "Suscríbete y ahorra",
  "title_a": "Arma tu rutina.",
  "title_b_italic": "Recibe a tu ritmo",
  "lead": "Elige los parches que quieres y la frecuencia con la que quieres recibirlos: cada 30, 60 o 90 días. Mientras más seguido, mayor descuento. Cancela cuando quieras.",
  "cta": "Suscríbete y ahorra",
  "no_commitment": "Sin compromiso · Cancela cuando quieras",
  "tiers": {
    "30": { "freq": "Cada 30 días", "tag": "Compromiso alto" },
    "60": { "freq": "Cada 60 días", "tag": "Equilibrado" },
    "90": { "freq": "Cada 90 días", "tag": "Probar la marca" }
  },
  "discount_format": "−{percent}%"
}
```

### 7. FinalCTA (`components/home/final-cta.tsx`)

**Layout:** centered section, navy bg, radial coral + teal glows.

**Copy**

- Title: "Pega, olvida y *deja que trabaje*." (italic span Newsreader, color gold)
- Lead: "Suscripción con 20% de descuento. Pausa, cambia o cancela cuando quieras."
- CTA: "Empieza tu ritual" → smooth scroll to `#productos`.

(Quiz button removed per Q5.)

**i18n keys (`pages.home.final_cta`)**

```json
{
  "title_a": "Pega, olvida y",
  "title_b_italic": "deja que trabaje",
  "lead": "Suscripción con 20% de descuento. Pausa, cambia o cancela cuando quieras.",
  "cta": "Empieza tu ritual"
}
```

### 8. Navbar (variant prop)

`apps/web/src/components/site/navbar.tsx` — modified.

**New prop signature**

```tsx
type NavbarProps = {
  locale: string;
  // variant is auto-detected from pathname; no prop drilling needed
};
```

**Auto-detection**

```tsx
const pathname = usePathname();
const isHome =
  pathname === `/${locale}` ||
  pathname === `/${locale}/`;
const variant: "transparent" | "default" = isHome ? "transparent" : "default";
```

**Visual differences**

| | `default` | `transparent` |
|---|---|---|
| position | sticky top-0 | absolute top-0 left-0 right-0, z-40 |
| background | `var(--cream)` | transparent at top of page |
| text color | `var(--navy)` | white |
| logo dot | coral | coral (unchanged) |
| border-bottom | 1px navy/6 | none |
| scroll behavior | unchanged | After window.scrollY > 100, animate to `bg-navy/92 backdrop-blur` and text stays white |

**Cart button** added to right-side controls (always rendered, not just home):

```tsx
<button
  type="button"
  onClick={() => useCart.getState().openDrawer()}
  aria-label={tCart("button_aria", { count })}
  className="..."
>
  <ShoppingBag className="h-5 w-5" />
  {hydrated && count > 0 && (
    <span className="...badge">{count}</span>
  )}
</button>
```

Sits between country selector and Clerk auth controls. On mobile it joins the existing right-side cluster (squeezed via gap reduction).

**i18n keys added (`components.navbar`)**

```json
{
  "links": {
    "products":  "Los parches",
    "science":   "La ciencia",
    "comparison": "Comparativa"
  },
  "cart": {
    "label": "Bolsa",
    "button_aria": "{count, plural, =0 {Bolsa, vacía} one {Bolsa, # parche} other {Bolsa, # parches}}"
  }
}
```

Nav links on home are hash anchors (`#productos`, `#ciencia`, `#comparativa`). On non-home pages, the `pages.home.*` nav links are hidden via `if (!isHome) return null;` for the link cluster. (Adding home-anchor cross-page links is a follow-up; keeps the navbar clean on `/cuenta`, `/sign-in`, etc.)

### 9. Footer (rewrite)

`apps/web/src/components/site/footer.tsx` — rewrite to match FooterC layout.

**Layout**

- Desktop: 5 columns — 4 nav cols + newsletter wider.
- Tablet: 2 columns of nav, newsletter full-width below.
- Mobile: 1 column — all nav cols stacked, newsletter at bottom, then bottom rule.

**Background:** `var(--cream-warm)` (`#FAF0EA`).

**Newsletter form**

```tsx
const submitNewsletter = async (formData: FormData) => {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const parsed = z.string().email().max(255).safeParse(email);
  if (!parsed.success) {
    toast.error(tFooter("newsletter.error_invalid"));
    return;
  }
  const country = (getCookie("country") ?? "MX").toUpperCase();
  try {
    await submitWaitlist({ email, country, source: "footer" });
    toast.success(tFooter("newsletter.success"));
  } catch (e) {
    if (e instanceof ApiError && e.code === "invalid_input") {
      toast.error(tFooter("newsletter.error_invalid"));
    } else {
      toast.error(tFooter("newsletter.error_generic"));
    }
  }
};
```

**Nav links**

All listed in i18n. Each renders as `<a href="#" aria-disabled="true" className="opacity-60 pointer-events-none" title={tFooter("coming_soon")}>{label}</a>` because the destinations don't exist yet (per Q5). Two exceptions:

- `subscribe` (Suscríbete y ahorra) → `href="#productos"` (anchor scroll), enabled.
- Future legal pages stay disabled until those plans land.

**i18n keys added (`components.footer`)**

```json
{
  "columns": {
    "shop":  { "title": "Comprar",  "links": { "store": "Tienda", "subs": "Suscripciones", "warranty": "Garantía" } },
    "help":  { "title": "Ayuda",    "links": { "contact": "Contáctanos", "faq": "Preguntas frecuentes", "refund": "Solicitar reembolso" } },
    "about": { "title": "Nosotros", "links": { "us": "Nosotros", "why": "¿Por qué parches?", "subscribe": "Suscríbete y ahorra" } },
    "legal": { "title": "Legal",    "links": { "privacy": "Aviso de Privacidad", "terms": "Términos y Condiciones" } }
  },
  "newsletter": {
    "title": "Newsletter",
    "lead": "Novedades y ofertas",
    "placeholder": "tu@correo.com",
    "submit": "Suscribirse",
    "success": "Te suscribimos. Mira tu inbox.",
    "error_invalid": "Email inválido",
    "error_generic": "Algo salió mal. Intenta luego."
  },
  "tagline": "Hecho con ciencia.",
  "rights": "© {year} Novapatch · {tagline}",
  "coming_soon": "Próximamente"
}
```

### 10. CartDrawer

`apps/web/src/components/cart/cart-drawer.tsx` — mounted at root in `app/[locale]/layout.tsx` so `openDrawer()` works from any page.

**Built on shadcn `<Sheet side="right">`** (already added via Plan #2 dependencies).

**Content states**

| State | Render |
|---|---|
| Empty | Centered illustration + title "Tu bolsa está vacía" + button "Empieza tu ritual" → `closeDrawer() + scrollToProducts()` |
| Items | Header "Tu bolsa (n)" → list of item rows → subtotal block → checkout button (disabled, tooltip) → "Vaciar bolsa" link |

**Item row**

```
┌─[image 64×64]─ Glow              ✕ │
│                $750 MXN              │
│                [-] 2 [+]             │
└──────────────────────────────────────┘
```

- Qty stepper buttons clamp at 1; `removeItem` triggered by ✕ or by qty going to 0 via the `-` button.
- Image uses `next/image` with fixed dimensions.

**Checkout button**

`<Button disabled className="w-full" aria-label="Próximamente">Ir al checkout →</Button>` with tooltip explaining Stripe arrives in Plan #5/6.

**i18n keys (`components.cart`)**

```json
{
  "drawer_title": "Tu bolsa",
  "drawer_count": "{count, plural, one {# parche} other {# parches}}",
  "empty_title": "Tu bolsa está vacía",
  "empty_cta": "Empieza tu ritual",
  "subtotal": "Subtotal",
  "shipping": "Envío",
  "shipping_later": "Calculado luego",
  "checkout_cta": "Ir al checkout",
  "checkout_disabled_tooltip": "Próximamente",
  "clear": "Vaciar bolsa",
  "remove_item": "Quitar {name}",
  "qty_label": "Cantidad de {name}"
}
```

## Performance

| Concern | Decision |
|---|---|
| Hero image (Glow at default selected=2) | `next/image` `priority sizes="(min-width:1024px) 50vw, 100vw"` |
| Other 5 product images | `next/image` `loading="lazy"` (fold ~3000px into the page) |
| Lifestyle photo | `next/image` `loading="lazy"` |
| Below-fold sections | Server components, no `dynamic()` (HTML stays under ~50KB) |
| CSS animations | Plan #2 `prefers-reduced-motion` rule covers keyframes. JS check covers `setInterval` |
| Newsletter validation | Zod in client before POST |
| Cart hydration | `partialize: items` only; `hydrated` flag prevents SSR mismatch on count badge |

Lighthouse target (mobile, manual verification): Performance ≥85, Accessibility ≥95, Best Practices ≥95.

## Accessibility

- Color contrast: every text-on-color combination must hit WCAG AA (4.5:1 normal, 3:1 large). Italic Newsreader spans on hero use the patch's accent color over a navy gradient — must be checked per patch (some accents may need a darker tint variant).
- Keyboard: all CTAs reachable, focus visible (Plan #2 default focus ring).
- Hero auto-rotation pauses on `focus` within the hero region (in addition to click).
- Cart drawer: `Sheet` from shadcn handles focus trap + escape close.
- Newsletter form: error/success toasts also announced via `sonner` (uses `aria-live="polite"` internally).
- All decorative SVGs / animations: `aria-hidden="true"`.
- All interactive icons: `aria-label` (e.g., cart button, remove item, qty stepper).

## Testing

### Unit tests (Vitest)

- `cart-store.test.ts`
  - addItem on new slug appends item with qty=1
  - addItem on existing slug increments qty
  - removeItem deletes by slug
  - setQty updates qty; setQty(slug, 0) removes the item
  - clear empties items
  - persist round-trip: writing items via `localStorage.setItem("novapatch.cart.v1", …)` then reading store reflects them
  - cartCount and cartTotal helpers compute correctly

### Component tests (Vitest + Testing Library + jsdom)

- `home/hero.test.tsx`
  - Renders default selected product (Glow) name in pill
  - Click selector swaps active product, pause flag set
  - With `prefers-reduced-motion: reduce` set, no setInterval is scheduled (mock matchMedia)
  - CTA primary calls `useCart.addItem` with correct payload

- `home/product-grid.test.tsx`
  - Renders 6 cards in canonical order
  - "Popular" badge appears only on Glow
  - Click "Agregar" calls `addItem(p, 750)` and `openDrawer()`

- `home/comparison.test.tsx`
  - Desktop layout: matchMedia mocked ≥768px renders table grid
  - Mobile layout: matchMedia mocked <768px renders 3 stacked cards, Novapatch first

- `cart/cart-drawer.test.tsx`
  - Empty state CTA closes drawer + invokes scroll handler
  - Item row qty +/– updates store
  - Remove button calls `removeItem`
  - Clear button calls `clear`
  - Checkout button is disabled

- `site/navbar.test.tsx`
  - Mock pathname `/es` → variant transparent (no `bg-cream` class, has `absolute` + `text-white`)
  - Mock pathname `/es/cuenta` → variant default (sticky, `bg-cream`, `text-navy`)
  - Cart button shows count when items exist (with `hydrated=true`)

- `site/footer.test.tsx`
  - Newsletter submit success: mocks `submitWaitlist`, asserts called with `{ email, country: "MX", source: "footer" }`, success toast appears
  - Newsletter submit invalid email: doesn't call API, error toast appears
  - Newsletter submit API throws `invalid_input`: error toast with invalid copy
  - Disabled nav links have `aria-disabled="true"` and `pointer-events-none`

### E2E (Playwright)

- `e2e/home-cart.spec.ts`
  1. Navigate `/es` — hero loads with Glow selected
  2. Click Energy in selector — hero background transitions, selector updates
  3. Click "Agregar" on first product card — drawer opens with the product
  4. Close drawer
  5. Click cart button in nav — drawer reopens, item still there
  6. Reload page — manually click cart button — drawer shows persisted item
  7. Click "Vaciar bolsa" — empty state shows
  8. Submit newsletter form in footer with `test-home@example.com` — success toast appears

(API call to `/waitlist` mocked in Playwright fixture or hits the dev API.)

### Accessibility checks

`@axe-core/react` integrated into Vitest run for the home page (top-level), Comparison, CartDrawer, Footer. No serious or critical violations allowed.

## Roadmap impact

- **Plan #4** (this plan): Home + cart store + drawer. Replaces the originally-planned "Tienda + Cart + PDP".
- **Plan #4b** (new follow-up): Tienda grid page + PDP per product, reusing `NOVA_PRODUCTS`, `useCart`, `<CartDrawer/>` from this plan.
- Plan #5 (Stripe MX): unchanged.
- Plan #6 (Checkout): wires the drawer's "Ir al checkout" to a real Stripe-backed flow.
- Plan #7 (Plan Builder): replaces the SubscriptionTeaser CTA copy + href to point to `/plan-builder`.
- ROADMAP.md will be updated in this plan to reflect the shift (Plan #4 = Home, old #4 → #4b).

## Open questions

None remaining at spec time. Any new ambiguity raised by the implementer must be escalated to the user via the subagent-driven-development "NEEDS_CONTEXT" path.
