# Home (Direction C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `/[locale]` homepage (DirectionC composition) with a Zustand+localStorage cart store + drawer, replacing the original Plan #4.

**Architecture:** Mobile-first sections in `components/home/*.tsx` (mix of Client + Server components), cart state in `components/cart/cart-store.ts`, drawer mounted in root layout. Existing Navbar gets a `variant="transparent"` mode auto-detected from pathname. Footer is rewritten with FooterC layout + newsletter wired to `POST /waitlist`. Full i18n under `pages.home.*`.

**Tech Stack:** Next.js 15 App Router · React 19 · Tailwind v4 · shadcn/ui · next-intl v4 · Zustand 4 + persist · Vitest + RTL · Playwright · Clerk (existing).

**Source-of-truth spec:** `docs/superpowers/specs/2026-04-27-home-direction-c-design.md` — read top-to-bottom before starting; this plan references its sections (e.g. "see spec §Hero · Layout") rather than duplicating visual detail.

**Critical project constraints (apply to every task):**

- `exactOptionalPropertyTypes: true` is on. Pass optional props with conditional spread: `{ ...(value !== undefined && { key: value }) }`. Never write `{ key: value ?? undefined }`.
- Italic editorial spans use `font-newsreader italic font-normal` (Plan #2 design system, NOT prototype's Outfit italic).
- Display headlines use `font-outfit font-black` (weight 900).
- Design tokens are in `apps/web/src/app/globals.css` `@theme inline` — use `var(--coral)`, `var(--teal)`, `var(--navy)`, `var(--cream)`, `var(--cream-warm)`, `var(--gold)`, `var(--sky)`, etc. Per-product colors (`color`, `ink`, `bg`) stay hardcoded inside `lib/products.ts` because they are catalog data, not theme tokens.
- All Client components start with `"use client";` directive on line 1.
- Server components fetch i18n via `getTranslations({ locale, namespace })`; Client components via `useTranslations(namespace)`.
- Hydration safety for cart count: `const count = hydrated ? cartCount(items) : 0`.
- Auto-rotation in hero: `typeof window !== "undefined"` guard + `window.matchMedia("(prefers-reduced-motion: reduce)").matches` check inside the `useEffect`.
- Use unique CSS keyframe names per component (`nc-descend-c`, `pulseHaloB`, `floatPatchB`) — names must not collide between sections.
- Package manager is **bun**; commands run from `apps/web/` unless noted.

**Test commands** (from `apps/web/`):

```bash
bun test                # Vitest (unit + component)
bun run test:e2e        # Playwright (added in Task 16 if missing)
bun run typecheck       # tsc --noEmit (verify exists; add in Task 1 if missing)
bun run lint            # next lint
```

---

## Task 1: Setup — deps, assets, products data, anchors helper

**Files:**

- Create: `apps/web/public/products/Energy.webp` `Sleep.webp` `Glow.webp` `Shield.webp` `Zen.webp` `Woman.webp` `lifestyle-apply.webp`
- Create: `apps/web/src/lib/products.ts`
- Create: `apps/web/src/lib/home-anchors.ts`
- Modify: `apps/web/package.json` (add `zustand`, ensure `typecheck` script exists)

### Steps

- [ ] **Step 1: Add zustand dependency**

```bash
cd apps/web && bun add zustand@^4.5.0
```

- [ ] **Step 2: Verify scripts in `apps/web/package.json`**

  Confirm these exist; if missing, add them:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit",
    "lint": "next lint"
  }
}
```

- [ ] **Step 3: Copy 7 webp assets**

```bash
mkdir -p apps/web/public/products
cp /tmp/np-design/novapatch-e-commerce/project/products/Energy.webp apps/web/public/products/
cp /tmp/np-design/novapatch-e-commerce/project/products/Sleep.webp  apps/web/public/products/
cp /tmp/np-design/novapatch-e-commerce/project/products/Glow.webp   apps/web/public/products/
cp /tmp/np-design/novapatch-e-commerce/project/products/Shield.webp apps/web/public/products/
cp /tmp/np-design/novapatch-e-commerce/project/products/Zen.webp    apps/web/public/products/
cp /tmp/np-design/novapatch-e-commerce/project/products/Woman.webp  apps/web/public/products/
cp /tmp/np-design/novapatch-e-commerce/project/products/lifestyle-apply.webp apps/web/public/products/
```

  If `lifestyle-apply.webp` is missing in the bundle, search for a comparable file under `/tmp/np-design/novapatch-e-commerce/project/uploads/` and copy/rename it; if none exists, leave the path and surface the gap to the user via `NEEDS_CONTEXT`.

- [ ] **Step 4: Create `apps/web/src/lib/products.ts`** with the 6 products from `data.jsx`, image paths rewritten to absolute `/products/X.webp`:

```ts
export type ProductMeta = {
  slug: "energy" | "sleep" | "glow" | "shield" | "zen" | "woman";
  name: string;
  image: string;
  tagline: string;
  quote: string;
  color: string;
  ink: string;
  bg: string;
  popular?: boolean;
  ingredients: string[];
  tags: string[];
};

export const NOVA_PRODUCTS: ProductMeta[] = [
  {
    slug: "energy",
    name: "Energy",
    image: "/products/Energy.webp",
    tagline: "Energía celular sostenida",
    quote: '"Tu día no para. Tu energía tampoco."',
    color: "#83B5F4",
    ink: "#1A5C9A",
    bg: "#EBF4FB",
    ingredients: ["Vitamina C", "L-Carnitina", "Té verde", "Ginseng", "B2", "Ácido Fólico", "Vitamina E"],
    tags: ["Energía sostenida", "Sin picos"],
  },
  {
    slug: "sleep",
    name: "Sleep",
    image: "/products/Sleep.webp",
    tagline: "Sueño profundo y reparador",
    quote: '"Porque descansar también es cuidarse."',
    color: "#1EB1BC",
    ink: "#0F6B5C",
    bg: "#E4F4F4",
    ingredients: ["Triptófano", "Magnesio", "Inositol", "B6", "Glicina"],
    tags: ["Descanso nocturno", "Sin somníferos"],
  },
  {
    slug: "glow",
    name: "Glow",
    image: "/products/Glow.webp",
    tagline: "Belleza desde adentro",
    quote: '"La piel también refleja cómo te cuidas."',
    color: "#F25C54",
    ink: "#B83525",
    bg: "#FAF0EE",
    popular: true,
    ingredients: ["Vitamina C", "Ácido Hialurónico", "Colágeno", "Biotina", "B3", "Centella Asiática", "Vitamina E"],
    tags: ["Desde adentro", "Constancia"],
  },
  {
    slug: "shield",
    name: "Shield",
    image: "/products/Shield.webp",
    tagline: "Fortaleza inmune natural",
    quote: '"Tu rutina de cuidado empieza hoy, no cuando algo pasa."',
    color: "#FFA849",
    ink: "#8C6000",
    bg: "#FAF6E9",
    ingredients: ["Vitamina C", "Zinc", "D3", "Vitamina E", "Niacinamida"],
    tags: ["Cuidado preventivo", "Uso diario"],
  },
  {
    slug: "zen",
    name: "Zen",
    image: "/products/Zen.webp",
    tagline: "Calma mental diaria",
    quote: '"El equilibrio que no se ve, pero se siente."',
    color: "#4E82BC",
    ink: "#2A5490",
    bg: "#EBF0F9",
    ingredients: ["Triptófano", "Magnesio", "Taurina", "Manzanilla", "B6"],
    tags: ["Calma funcional", "Días intensos"],
  },
  {
    slug: "woman",
    name: "Woman",
    image: "/products/Woman.webp",
    tagline: "Bienestar hormonal femenino",
    quote: '"Escucharte también es una forma de cuidarte."',
    color: "#C693C4",
    ink: "#6B3080",
    bg: "#F3EBF9",
    ingredients: ["Extracto de Soya", "B6", "Magnesio", "Ácido Fólico", "Hierro"],
    tags: ["Bienestar femenino", "Ritmos naturales"],
  },
];

export const RETAIL_PRICE = 750;
export const SUB_DISCOUNTS = { 30: 0.20, 60: 0.15, 90: 0.10 } as const;
```

- [ ] **Step 5: Create `apps/web/src/lib/home-anchors.ts`** — small smooth-scroll helper used by Hero, Absorption, FinalCTA, Footer "subscribe" link, SubscriptionTeaser CTA:

```ts
export const HOME_ANCHORS = {
  products:   "productos",
  science:    "ciencia",
  comparison: "comparativa",
} as const;

export type HomeAnchor = keyof typeof HOME_ANCHORS;

/** Smooth-scrolls to the anchor section on the home page. Safe in SSR (no-op when window undefined). */
export function scrollToAnchor(anchor: HomeAnchor): void {
  if (typeof window === "undefined") return;
  const el = document.getElementById(HOME_ANCHORS[anchor]);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}
```

- [ ] **Step 6: Verify**

```bash
cd apps/web && bun run typecheck && bun run lint
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json apps/web/bun.lockb apps/web/public/products apps/web/src/lib/products.ts apps/web/src/lib/home-anchors.ts
git commit -m "chore(home): scaffold products data, assets, and anchor helper"
```

---

## Task 2: Cart store (TDD)

**Files:**

- Create: `apps/web/src/components/cart/cart-store.ts`
- Create: `apps/web/test/unit/cart-store.test.ts`

### Steps

- [ ] **Step 1: Write the failing test file**

  `apps/web/test/unit/cart-store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { useCart, cartCount, cartTotal } from "@/components/cart/cart-store";
import type { ProductMeta } from "@/lib/products";

const energy: ProductMeta = {
  slug: "energy",
  name: "Energy",
  image: "/products/Energy.webp",
  tagline: "t",
  quote: "q",
  color: "#83B5F4",
  ink: "#1A5C9A",
  bg: "#EBF4FB",
  ingredients: [],
  tags: [],
};

const glow: ProductMeta = { ...energy, slug: "glow", name: "Glow", color: "#F25C54", ink: "#B83525" };

beforeEach(() => {
  localStorage.clear();
  useCart.setState({ items: [], drawerOpen: false });
});

describe("cart-store", () => {
  it("addItem on a new slug appends with qty=1", () => {
    useCart.getState().addItem(energy, 750);
    expect(useCart.getState().items).toEqual([
      expect.objectContaining({ slug: "energy", name: "Energy", price: 750, qty: 1 }),
    ]);
  });

  it("addItem on an existing slug increments qty", () => {
    useCart.getState().addItem(energy, 750);
    useCart.getState().addItem(energy, 750);
    expect(useCart.getState().items).toHaveLength(1);
    expect(useCart.getState().items[0]?.qty).toBe(2);
  });

  it("removeItem deletes by slug", () => {
    useCart.getState().addItem(energy, 750);
    useCart.getState().addItem(glow, 750);
    useCart.getState().removeItem("energy");
    expect(useCart.getState().items.map((i) => i.slug)).toEqual(["glow"]);
  });

  it("setQty updates a positive qty", () => {
    useCart.getState().addItem(energy, 750);
    useCart.getState().setQty("energy", 5);
    expect(useCart.getState().items[0]?.qty).toBe(5);
  });

  it("setQty(slug, 0) removes the item", () => {
    useCart.getState().addItem(energy, 750);
    useCart.getState().setQty("energy", 0);
    expect(useCart.getState().items).toEqual([]);
  });

  it("clear empties items", () => {
    useCart.getState().addItem(energy, 750);
    useCart.getState().addItem(glow, 750);
    useCart.getState().clear();
    expect(useCart.getState().items).toEqual([]);
  });

  it("openDrawer / closeDrawer toggle drawerOpen", () => {
    useCart.getState().openDrawer();
    expect(useCart.getState().drawerOpen).toBe(true);
    useCart.getState().closeDrawer();
    expect(useCart.getState().drawerOpen).toBe(false);
  });

  it("persist round-trips items through localStorage under key novapatch.cart.v1", () => {
    useCart.getState().addItem(energy, 750);
    useCart.getState().setQty("energy", 3);
    const raw = localStorage.getItem("novapatch.cart.v1");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed.state.items[0]).toMatchObject({ slug: "energy", qty: 3 });
  });

  it("cartCount sums quantities", () => {
    expect(cartCount([])).toBe(0);
    expect(
      cartCount([
        { slug: "energy", name: "Energy", price: 750, qty: 2, color: "", ink: "", image: "" },
        { slug: "glow",   name: "Glow",   price: 750, qty: 3, color: "", ink: "", image: "" },
      ]),
    ).toBe(5);
  });

  it("cartTotal sums price * qty", () => {
    expect(
      cartTotal([
        { slug: "energy", name: "Energy", price: 750, qty: 2, color: "", ink: "", image: "" },
        { slug: "glow",   name: "Glow",   price: 700, qty: 1, color: "", ink: "", image: "" },
      ]),
    ).toBe(2200);
  });
});
```

- [ ] **Step 2: Run test → expect FAIL** (module does not exist yet)

```bash
cd apps/web && bun test test/unit/cart-store.test.ts
```

- [ ] **Step 3: Implement `apps/web/src/components/cart/cart-store.ts`** — verbatim from spec §Cart store:

```ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ProductMeta } from "@/lib/products";

export type CartItem = {
  slug: string;
  name: string;
  price: number;
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

export const cartCount = (items: CartItem[]): number =>
  items.reduce((s, i) => s + i.qty, 0);

export const cartTotal = (items: CartItem[]): number =>
  items.reduce((s, i) => s + i.price * i.qty, 0);
```

- [ ] **Step 4: Run test → expect PASS**

```bash
cd apps/web && bun test test/unit/cart-store.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/cart/cart-store.ts apps/web/test/unit/cart-store.test.ts
git commit -m "feat(cart): add Zustand cart store with localStorage persistence"
```

---

## Task 3: Cart button (nav badge with hydration safety)

**Files:**

- Create: `apps/web/src/components/cart/cart-button.tsx`
- Create: `apps/web/test/components/cart/cart-button.test.tsx`
- Modify: `apps/web/messages/es.json` — add `components.cart.button_aria` etc.

### Steps

- [ ] **Step 1: Add i18n keys** under `components.cart` in `apps/web/messages/es.json` (full set used here + by drawer + navbar):

```json
"components": {
  "cart": {
    "button_aria": "{count, plural, =0 {Bolsa, vacía} one {Bolsa, # parche} other {Bolsa, # parches}}",
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
}
```

- [ ] **Step 2: Write failing test `apps/web/test/components/cart/cart-button.test.tsx`**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/../messages/es.json";
import { CartButton } from "@/components/cart/cart-button";
import { useCart } from "@/components/cart/cart-store";

const wrap = (ui: React.ReactNode) => (
  <NextIntlClientProvider locale="es" messages={messages}>
    {ui}
  </NextIntlClientProvider>
);

beforeEach(() => {
  localStorage.clear();
  useCart.setState({ items: [], drawerOpen: false, hydrated: true });
});

describe("CartButton", () => {
  it("renders no badge when cart empty", () => {
    render(wrap(<CartButton />));
    expect(screen.queryByTestId("cart-count")).toBeNull();
  });

  it("renders count badge when items exist and store hydrated", () => {
    useCart.setState({
      items: [{ slug: "energy", name: "Energy", price: 750, qty: 2, color: "", ink: "", image: "" }],
      hydrated: true,
    });
    render(wrap(<CartButton />));
    expect(screen.getByTestId("cart-count")).toHaveTextContent("2");
  });

  it("hides count when not yet hydrated to avoid SSR mismatch", () => {
    useCart.setState({
      items: [{ slug: "energy", name: "Energy", price: 750, qty: 2, color: "", ink: "", image: "" }],
      hydrated: false,
    });
    render(wrap(<CartButton />));
    expect(screen.queryByTestId("cart-count")).toBeNull();
  });

  it("opens drawer on click", () => {
    render(wrap(<CartButton />));
    fireEvent.click(screen.getByRole("button"));
    expect(useCart.getState().drawerOpen).toBe(true);
  });
});
```

- [ ] **Step 3: Run → FAIL**

```bash
cd apps/web && bun test test/components/cart/cart-button.test.tsx
```

- [ ] **Step 4: Implement `apps/web/src/components/cart/cart-button.tsx`**

```tsx
"use client";

import { ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCart, cartCount } from "@/components/cart/cart-store";

type Variant = "transparent" | "default";

interface CartButtonProps {
  variant?: Variant;
  className?: string;
}

export function CartButton({ variant = "default", className = "" }: CartButtonProps) {
  const t = useTranslations("components.cart");
  const items    = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);
  const open     = useCart((s) => s.openDrawer);
  const count    = hydrated ? cartCount(items) : 0;

  const tone =
    variant === "transparent"
      ? "text-white hover:bg-white/10"
      : "text-navy hover:bg-navy/5";

  return (
    <button
      type="button"
      onClick={open}
      aria-label={t("button_aria", { count })}
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full transition ${tone} ${className}`}
    >
      <ShoppingBag className="h-5 w-5" aria-hidden />
      {hydrated && count > 0 && (
        <span
          data-testid="cart-count"
          className="absolute -top-1 -right-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1 text-[11px] font-bold text-white"
        >
          {count}
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 5: Run → PASS**, commit:

```bash
git add apps/web/src/components/cart/cart-button.tsx apps/web/test/components/cart/cart-button.test.tsx apps/web/messages/es.json
git commit -m "feat(cart): add nav cart button with hydration-safe count badge"
```

---

## Task 4: Cart drawer (shadcn Sheet)

**Files:**

- Create: `apps/web/src/components/cart/cart-drawer.tsx`
- Create: `apps/web/test/components/cart/cart-drawer.test.tsx`

### Steps

- [ ] **Step 1: Verify shadcn Sheet is installed**

  Check `apps/web/src/components/ui/sheet.tsx` exists (it does per the existing navbar import). If not, run `bunx shadcn@latest add sheet` from `apps/web/`.

- [ ] **Step 2: Write failing test `apps/web/test/components/cart/cart-drawer.test.tsx`**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/../messages/es.json";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { useCart } from "@/components/cart/cart-store";

const wrap = (ui: React.ReactNode) => (
  <NextIntlClientProvider locale="es" messages={messages}>
    {ui}
  </NextIntlClientProvider>
);

const seedItem = () =>
  useCart.setState({
    drawerOpen: true,
    hydrated: true,
    items: [
      { slug: "energy", name: "Energy", price: 750, qty: 2, color: "#83B5F4", ink: "#1A5C9A", image: "/products/Energy.webp" },
    ],
  });

beforeEach(() => {
  localStorage.clear();
  useCart.setState({ items: [], drawerOpen: false, hydrated: true });
});

describe("CartDrawer", () => {
  it("shows empty state when items=[]", () => {
    useCart.setState({ drawerOpen: true });
    render(wrap(<CartDrawer />));
    expect(screen.getByText("Tu bolsa está vacía")).toBeInTheDocument();
  });

  it("empty CTA closes drawer", () => {
    useCart.setState({ drawerOpen: true });
    render(wrap(<CartDrawer />));
    fireEvent.click(screen.getByRole("button", { name: "Empieza tu ritual" }));
    expect(useCart.getState().drawerOpen).toBe(false);
  });

  it("renders item row with name + qty + price", () => {
    seedItem();
    render(wrap(<CartDrawer />));
    expect(screen.getByText("Energy")).toBeInTheDocument();
    expect(screen.getByLabelText("Cantidad de Energy")).toHaveTextContent("2");
  });

  it("qty + button increments", () => {
    seedItem();
    render(wrap(<CartDrawer />));
    fireEvent.click(screen.getByRole("button", { name: /\+/ }));
    expect(useCart.getState().items[0]?.qty).toBe(3);
  });

  it("qty - button decrements; at 1 it removes the item", () => {
    seedItem();
    render(wrap(<CartDrawer />));
    fireEvent.click(screen.getByRole("button", { name: /−|-/ }));   // qty 2 → 1
    expect(useCart.getState().items[0]?.qty).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: /−|-/ }));   // qty 1 → removed
    expect(useCart.getState().items).toHaveLength(0);
  });

  it("remove button deletes the item", () => {
    seedItem();
    render(wrap(<CartDrawer />));
    fireEvent.click(screen.getByRole("button", { name: "Quitar Energy" }));
    expect(useCart.getState().items).toHaveLength(0);
  });

  it("clear button empties items", () => {
    seedItem();
    render(wrap(<CartDrawer />));
    fireEvent.click(screen.getByRole("button", { name: "Vaciar bolsa" }));
    expect(useCart.getState().items).toHaveLength(0);
  });

  it("checkout button is disabled", () => {
    seedItem();
    render(wrap(<CartDrawer />));
    expect(screen.getByRole("button", { name: /Ir al checkout/ })).toBeDisabled();
  });
});
```

- [ ] **Step 3: Run → FAIL.**

- [ ] **Step 4: Implement `apps/web/src/components/cart/cart-drawer.tsx`** — uses shadcn `Sheet` controlled by store; see spec §10. Skeleton:

```tsx
"use client";

import Image from "next/image";
import { Minus, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart, cartCount, cartTotal } from "@/components/cart/cart-store";
import { scrollToAnchor } from "@/lib/home-anchors";

export function CartDrawer() {
  const t = useTranslations("components.cart");
  const items     = useCart((s) => s.items);
  const open      = useCart((s) => s.drawerOpen);
  const setOpen   = useCart((s) => (v: boolean) => (v ? s.openDrawer() : s.closeDrawer()));
  const closeDrawer = useCart((s) => s.closeDrawer);
  const setQty    = useCart((s) => s.setQty);
  const removeItem = useCart((s) => s.removeItem);
  const clear     = useCart((s) => s.clear);

  const count    = cartCount(items);
  const subtotal = cartTotal(items);
  const empty    = items.length === 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="flex w-full max-w-md flex-col bg-cream">
        <SheetHeader>
          <SheetTitle className="font-outfit text-2xl font-black text-navy">
            {t("drawer_title")}{!empty && ` · ${t("drawer_count", { count })}`}
          </SheetTitle>
        </SheetHeader>

        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-lg font-semibold text-navy">{t("empty_title")}</p>
            <Button
              onClick={() => { closeDrawer(); scrollToAnchor("products"); }}
              className="bg-coral text-white hover:bg-coral/90"
            >
              {t("empty_cta")}
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto px-2 py-4">
              {items.map((it) => (
                <li key={it.slug} className="flex items-center gap-3 rounded-2xl bg-white/60 p-3">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg" style={{ background: it.color + "22" }}>
                    <Image src={it.image} alt="" fill sizes="64px" className="object-contain" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-outfit font-black text-navy">{it.name}</p>
                      <button
                        type="button"
                        aria-label={t("remove_item", { name: it.name })}
                        onClick={() => removeItem(it.slug)}
                        className="text-navy/60 hover:text-coral"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-sm text-navy/70">${it.price} MXN</p>
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-navy/10 bg-white px-1">
                      <button
                        type="button"
                        aria-label="−"
                        onClick={() => setQty(it.slug, it.qty - 1)}
                        className="grid h-7 w-7 place-items-center rounded-full hover:bg-navy/5"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span aria-label={t("qty_label", { name: it.name })} className="min-w-6 text-center text-sm font-semibold">
                        {it.qty}
                      </span>
                      <button
                        type="button"
                        aria-label="+"
                        onClick={() => setQty(it.slug, it.qty + 1)}
                        className="grid h-7 w-7 place-items-center rounded-full hover:bg-navy/5"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-navy/10 px-4 py-4">
              <div className="flex items-center justify-between text-sm text-navy/70">
                <span>{t("shipping")}</span>
                <span>{t("shipping_later")}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-lg">
                <span className="font-semibold text-navy">{t("subtotal")}</span>
                <span className="font-outfit font-black text-navy">${subtotal} MXN</span>
              </div>
              <Button
                disabled
                aria-label={t("checkout_disabled_tooltip")}
                className="mt-4 w-full bg-coral text-white hover:bg-coral/90 disabled:opacity-60"
                title={t("checkout_disabled_tooltip")}
              >
                {t("checkout_cta")} →
              </Button>
              <button
                type="button"
                onClick={clear}
                className="mt-3 block w-full text-center text-sm text-navy/60 underline-offset-2 hover:text-coral hover:underline"
              >
                {t("clear")}
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 5: Run → PASS**

```bash
cd apps/web && bun test test/components/cart/cart-drawer.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/cart/cart-drawer.tsx apps/web/test/components/cart/cart-drawer.test.tsx
git commit -m "feat(cart): add cart drawer with empty + populated states"
```

---

## Task 5: Mount cart drawer in root layout

**Files:**

- Modify: `apps/web/src/app/[locale]/layout.tsx`

### Steps

- [ ] **Step 1: Read current layout** to understand its structure (Clerk + next-intl provider, body, etc.).

- [ ] **Step 2: Add `<CartDrawer />`** mount inside the existing providers tree, after `<CountryGate />` and before `</NextIntlClientProvider>` (or equivalent boundary that lives on every page):

```tsx
import { CartDrawer } from "@/components/cart/cart-drawer";

// inside the provider tree, alongside <CountryGate />:
<CartDrawer />
```

  No other changes — the Sheet is rendered inert (closed) until any consumer calls `useCart.getState().openDrawer()`.

- [ ] **Step 3: Verify** by running typecheck + dev server briefly:

```bash
cd apps/web && bun run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/[locale]/layout.tsx
git commit -m "feat(cart): mount cart drawer in root layout for global access"
```

---

## Task 6: Navbar — variant=transparent + cart button

**Files:**

- Modify: `apps/web/src/components/site/navbar.tsx`
- Modify: `apps/web/messages/es.json` — add `components.navbar.cart` and `components.navbar.links`
- Create: `apps/web/test/components/site/navbar.test.tsx`

### Steps

- [ ] **Step 1: Add i18n keys** under `components.navbar` in `apps/web/messages/es.json`:

```json
"components": {
  "navbar": {
    "links": {
      "products":   "Los parches",
      "science":    "La ciencia",
      "comparison": "Comparativa"
    }
  }
}
```

  (`button_aria` and the cart copy are already in `components.cart` from Task 3.)

- [ ] **Step 2: Write failing test `apps/web/test/components/site/navbar.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/../messages/es.json";
import { useCart } from "@/components/cart/cart-store";

const pathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => pathname(),
}));
vi.mock("@clerk/nextjs", () => ({
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedOut: () => null,
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  UserButton: () => <div data-testid="clerk-user-button" />,
}));

import { Navbar } from "@/components/site/navbar";

const wrap = (ui: React.ReactNode) => (
  <NextIntlClientProvider locale="es" messages={messages}>
    {ui}
  </NextIntlClientProvider>
);

beforeEach(() => {
  localStorage.clear();
  useCart.setState({ items: [], drawerOpen: false, hydrated: true });
});

describe("Navbar variant detection", () => {
  it("transparent variant on /es (home)", () => {
    pathname.mockReturnValue("/es");
    const { container } = render(wrap(<Navbar locale="es" />));
    const header = container.querySelector("header");
    expect(header?.className).toMatch(/absolute/);
    expect(header?.className).not.toMatch(/bg-cream/);
  });

  it("default variant on non-home pages", () => {
    pathname.mockReturnValue("/es/cuenta");
    const { container } = render(wrap(<Navbar locale="es" />));
    const header = container.querySelector("header");
    expect(header?.className).not.toMatch(/absolute/);
    expect(header?.className).toMatch(/bg-cream|bg-background/);
  });

  it("renders home anchor links only on home", () => {
    pathname.mockReturnValue("/es");
    render(wrap(<Navbar locale="es" />));
    expect(screen.getByRole("link", { name: "Los parches" })).toBeInTheDocument();
  });

  it("hides home anchors on non-home", () => {
    pathname.mockReturnValue("/es/cuenta");
    render(wrap(<Navbar locale="es" />));
    expect(screen.queryByRole("link", { name: "Los parches" })).toBeNull();
  });

  it("cart button renders on every page", () => {
    pathname.mockReturnValue("/es/cuenta");
    render(wrap(<Navbar locale="es" />));
    expect(screen.getByRole("button", { name: /Bolsa/ })).toBeInTheDocument();
  });

  it("cart button shows count when items exist + hydrated", () => {
    pathname.mockReturnValue("/es");
    useCart.setState({
      items: [{ slug: "energy", name: "Energy", price: 750, qty: 2, color: "", ink: "", image: "" }],
      hydrated: true,
    });
    render(wrap(<Navbar locale="es" />));
    expect(screen.getByTestId("cart-count")).toHaveTextContent("2");
  });
});
```

- [ ] **Step 3: Modify `apps/web/src/components/site/navbar.tsx`** to add the variant + cart button. Replace its body with the variant-aware layout (preserve existing Clerk + CountrySelector + mobile sheet code; only add new behavior):

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CountrySelector } from "@/components/site/country-selector";
import { CartButton } from "@/components/cart/cart-button";
import { HOME_ANCHORS } from "@/lib/home-anchors";

interface NavbarProps {
  locale: string;
}

export function Navbar({ locale }: NavbarProps) {
  const tNav  = useTranslations("site.navbar");
  const tHome = useTranslations("components.navbar.links");
  const tAcct = useTranslations("nav");
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const base = `/${locale}`;
  const isHome = pathname === base || pathname === `${base}/`;
  const variant: "transparent" | "default" = isHome ? "transparent" : "default";

  useEffect(() => {
    if (variant !== "transparent") return;
    const onScroll = () => setScrolled(window.scrollY > 100);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [variant]);

  const headerCls =
    variant === "transparent"
      ? `absolute left-0 right-0 top-0 z-40 transition-colors duration-300 ${
          scrolled ? "bg-navy/[0.92] backdrop-blur" : "bg-transparent"
        }`
      : "sticky top-0 z-40 border-b border-navy/10 bg-cream";

  const linkCls =
    variant === "transparent"
      ? "text-sm text-white/85 hover:text-white"
      : "text-sm text-navy/70 hover:text-navy";

  const homeAnchors = [
    { href: `#${HOME_ANCHORS.products}`,   key: "products"   as const },
    { href: `#${HOME_ANCHORS.science}`,    key: "science"    as const },
    { href: `#${HOME_ANCHORS.comparison}`, key: "comparison" as const },
  ];

  return (
    <header className={headerCls}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link
          href={base}
          className={`text-lg font-black tracking-tight ${variant === "transparent" ? "text-white" : "text-navy"}`}
        >
          Novapatch<span className="text-coral">.</span>
        </Link>

        {/* Home-only anchor links */}
        {isHome && (
          <nav className="hidden items-center gap-6 md:flex">
            {homeAnchors.map((a) => (
              <a key={a.key} href={a.href} className={linkCls}>
                {tHome(a.key)}
              </a>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2">
            <CountrySelector />
          </div>
          <CartButton {...(variant === "transparent" && { variant: "transparent" as const })} />
          <SignedIn>
            <UserButton />
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <Button size="sm" className={variant === "transparent" ? "bg-white text-navy hover:bg-white/90" : ""}>
                {tAcct("iniciar_sesion")}
              </Button>
            </SignInButton>
          </SignedOut>

          {/* Mobile sheet (preserved from existing nav) */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={tNav("open_menu")}
                className={`md:hidden ${variant === "transparent" ? "text-white hover:bg-white/10" : ""}`}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>Novapatch</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-4 px-4">
                {isHome &&
                  homeAnchors.map((a) => (
                    <a
                      key={a.key}
                      href={a.href}
                      onClick={() => setSheetOpen(false)}
                      className="text-base text-foreground"
                    >
                      {tHome(a.key)}
                    </a>
                  ))}
                <SignedIn>
                  <Link href={`${base}/cuenta`} onClick={() => setSheetOpen(false)} className="text-base text-muted-foreground">
                    {tAcct("mi_cuenta")}
                  </Link>
                </SignedIn>
                <div className="mt-2 border-t border-navy/10 pt-4">
                  <CountrySelector expanded />
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
```

  Notes on `exactOptionalPropertyTypes`: `<CartButton {...(variant === "transparent" && { variant: "transparent" as const })} />` uses the conditional-spread idiom — never pass `variant={undefined}`.

- [ ] **Step 4: Run → PASS**, commit:

```bash
cd apps/web && bun test test/components/site/navbar.test.tsx
git add apps/web/src/components/site/navbar.tsx apps/web/test/components/site/navbar.test.tsx apps/web/messages/es.json
git commit -m "feat(navbar): add transparent home variant and global cart button"
```

---

## Task 7: Footer rewrite (FooterC layout + newsletter)

**Files:**

- Modify: `apps/web/src/components/site/footer.tsx` (full rewrite)
- Modify: `apps/web/messages/es.json` — add `components.footer.*`
- Create: `apps/web/test/components/site/footer.test.tsx`

### Steps

- [ ] **Step 1: Add `components.footer.*` i18n keys** verbatim from spec §9.

- [ ] **Step 2: Confirm `submitWaitlist` and `getCookie` exist** (`apps/web/src/lib/api-client.ts` and `apps/web/src/lib/cookies.ts` per Plan #3). Confirm `sonner` is installed; `toast` is already used in country-selector (existing Plan #3 dep).

- [ ] **Step 3: Write failing test `apps/web/test/components/site/footer.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/../messages/es.json";

const submitWaitlist = vi.fn();
const toastSuccess   = vi.fn();
const toastError     = vi.fn();

vi.mock("@/lib/api-client", () => ({
  submitWaitlist: (...a: unknown[]) => submitWaitlist(...a),
  ApiError: class ApiError extends Error { code: string; constructor(c: string, m: string){ super(m); this.code = c; } },
}));
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));
vi.mock("@/lib/cookies", () => ({ getCookie: () => "MX" }));

import { Footer } from "@/components/site/footer";

const wrap = (ui: React.ReactNode) => (
  <NextIntlClientProvider locale="es" messages={messages}>{ui}</NextIntlClientProvider>
);

beforeEach(() => {
  submitWaitlist.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe("Footer newsletter", () => {
  it("submits valid email and shows success", async () => {
    submitWaitlist.mockResolvedValueOnce({ ok: true });
    render(wrap(<Footer />));
    fireEvent.change(screen.getByPlaceholderText("tu@correo.com"), { target: { value: "test@np.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Suscribirse" }));
    await waitFor(() => {
      expect(submitWaitlist).toHaveBeenCalledWith({ email: "test@np.com", country: "MX", source: "footer" });
      expect(toastSuccess).toHaveBeenCalled();
    });
  });

  it("rejects invalid email locally, no API call", async () => {
    render(wrap(<Footer />));
    fireEvent.change(screen.getByPlaceholderText("tu@correo.com"), { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByRole("button", { name: "Suscribirse" }));
    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
      expect(submitWaitlist).not.toHaveBeenCalled();
    });
  });

  it("renders disabled nav links with aria-disabled", () => {
    render(wrap(<Footer />));
    const tienda = screen.getByText("Tienda");
    expect(tienda.getAttribute("aria-disabled")).toBe("true");
    expect(tienda.className).toMatch(/pointer-events-none/);
  });

  it("subscribe link points to #productos and is enabled", () => {
    render(wrap(<Footer />));
    const sub = screen.getByText("Suscríbete y ahorra").closest("a");
    expect(sub?.getAttribute("href")).toBe("#productos");
    expect(sub?.getAttribute("aria-disabled")).not.toBe("true");
  });
});
```

- [ ] **Step 4: Implement `apps/web/src/components/site/footer.tsx`** — full rewrite. See spec §9 (Footer rewrite) for layout. Skeleton:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { toast } from "sonner";
import { submitWaitlist, ApiError } from "@/lib/api-client";
import { getCookie } from "@/lib/cookies";

const COLUMNS = [
  { key: "shop",  links: ["store", "subs", "warranty"] },
  { key: "help",  links: ["contact", "faq", "refund"] },
  { key: "about", links: ["us", "why", "subscribe"] },
  { key: "legal", links: ["privacy", "terms"] },
] as const;

// Only "subscribe" has a real (anchor) destination today.
const ENABLED_LINKS = new Set<string>(["about.subscribe"]);
const linkHref = (col: string, key: string): string =>
  col === "about" && key === "subscribe" ? "#productos" : "#";

export function Footer() {
  const t  = useTranslations("components.footer");
  const [email, setEmail] = useState("");
  const [busy, setBusy]   = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const cleaned = email.trim().toLowerCase();
    const parsed  = z.string().email().max(255).safeParse(cleaned);
    if (!parsed.success) { toast.error(t("newsletter.error_invalid")); return; }
    const country = (getCookie("country") ?? "MX").toUpperCase();
    setBusy(true);
    try {
      await submitWaitlist({ email: cleaned, country, source: "footer" });
      toast.success(t("newsletter.success"));
      setEmail("");
    } catch (err) {
      if (err instanceof ApiError && err.code === "invalid_input") {
        toast.error(t("newsletter.error_invalid"));
      } else {
        toast.error(t("newsletter.error_generic"));
      }
    } finally {
      setBusy(false);
    }
  };

  const year = new Date().getFullYear();

  return (
    <footer className="bg-[var(--cream-warm)] py-16">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-2 lg:grid-cols-[repeat(4,1fr)_1.4fr]">
        {COLUMNS.map((col) => (
          <div key={col.key}>
            <h4 className="font-outfit text-sm font-black uppercase tracking-wider text-navy">
              {t(`columns.${col.key}.title`)}
            </h4>
            <ul className="mt-4 space-y-2 text-sm">
              {col.links.map((lk) => {
                const enabled = ENABLED_LINKS.has(`${col.key}.${lk}`);
                return (
                  <li key={lk}>
                    <a
                      href={linkHref(col.key, lk)}
                      {...(!enabled && { "aria-disabled": "true", title: t("coming_soon") })}
                      className={enabled
                        ? "text-navy/80 hover:text-coral"
                        : "pointer-events-none text-navy/50 opacity-60"}
                    >
                      {t(`columns.${col.key}.links.${lk}`)}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <form onSubmit={onSubmit} className="md:col-span-2 lg:col-span-1">
          <h4 className="font-outfit text-sm font-black uppercase tracking-wider text-navy">{t("newsletter.title")}</h4>
          <p className="mt-2 text-sm text-navy/70">{t("newsletter.lead")}</p>
          <div className="mt-3 flex gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("newsletter.placeholder")}
              className="flex-1 rounded-full border border-navy/10 bg-white px-4 py-2 text-sm text-navy focus:border-coral focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white hover:bg-coral/90 disabled:opacity-60"
            >
              {t("newsletter.submit")}
            </button>
          </div>
        </form>
      </div>

      <div className="mx-auto mt-12 flex max-w-6xl items-center justify-between border-t border-navy/10 px-4 pt-6 text-xs text-navy/60">
        <span>{t("rights", { year, tagline: t("tagline") })}</span>
        <span>Hecho en México</span>
      </div>
    </footer>
  );
}
```

- [ ] **Step 5: Run → PASS**

```bash
cd apps/web && bun test test/components/site/footer.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/site/footer.tsx apps/web/test/components/site/footer.test.tsx apps/web/messages/es.json
git commit -m "feat(footer): rewrite with FooterC layout + waitlist newsletter"
```

---

## Task 8: Hero section (Client + animations)

**Files:**

- Create: `apps/web/src/components/home/hero.tsx`
- Create: `apps/web/test/components/home/hero.test.tsx`
- Modify: `apps/web/messages/es.json` — add `pages.home.hero.*`

See spec §1 (Hero) for full visual layout (split layout, halo pulse 4s, float patch 5s, color-shift gradient, orbiting ingredient chips desktop / 2-up-2-down mobile, horizontal scroll-snap selector, italic Newsreader span color = `selected.color`).

### Steps

- [ ] **Step 1: Add `pages.home.hero.*` keys** verbatim from spec.

- [ ] **Step 2: Write failing test `apps/web/test/components/home/hero.test.tsx`**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/../messages/es.json";
import { useCart } from "@/components/cart/cart-store";

beforeEach(() => {
  localStorage.clear();
  useCart.setState({ items: [], drawerOpen: false, hydrated: true });
  vi.useRealTimers();
  // matchMedia stub
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((q: string) => ({
      matches: false,
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

import { Hero } from "@/components/home/hero";

const wrap = (ui: React.ReactNode) => (
  <NextIntlClientProvider locale="es" messages={messages}>{ui}</NextIntlClientProvider>
);

describe("Hero", () => {
  it("renders the default selected product (Glow) name in pill copy", () => {
    render(wrap(<Hero />));
    expect(screen.getByText(/Glow/)).toBeInTheDocument();
  });

  it("clicking a different selector swaps the active product and pauses rotation", () => {
    render(wrap(<Hero />));
    const energyButton = screen.getByRole("button", { name: /Mostrar parche Energy/i });
    fireEvent.click(energyButton);
    expect(energyButton.getAttribute("aria-pressed")).toBe("true");
  });

  it("does not start setInterval when prefers-reduced-motion is reduce", () => {
    (window.matchMedia as any).mockImplementation((q: string) => ({
      matches: q.includes("reduce"),
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const setInt = vi.spyOn(globalThis, "setInterval");
    render(wrap(<Hero />));
    expect(setInt).not.toHaveBeenCalled();
    setInt.mockRestore();
  });

  it("primary CTA adds the selected product to cart at $750 and opens drawer", () => {
    render(wrap(<Hero />));
    const cta = screen.getByRole("button", { name: /Agregar Glow · \$750/ });
    fireEvent.click(cta);
    const items = useCart.getState().items;
    expect(items[0]).toMatchObject({ slug: "glow", price: 750, qty: 1 });
    expect(useCart.getState().drawerOpen).toBe(true);
  });
});
```

- [ ] **Step 3: Run → FAIL.** Then implement `apps/web/src/components/home/hero.tsx`. Skeleton — see spec §Hero · State + animations and §Hero · Typography for full styling. Key class names: section uses `relative min-h-[100svh]`, gradient applied via inline `style` for color-shift transition, italic span gets `font-newsreader italic font-normal`, headline gets `font-outfit font-black`. Selector buttons use `aria-pressed={i === selected}` and `aria-label`. Decorative halo + float wrappers must include `aria-hidden`.

```tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { NOVA_PRODUCTS, RETAIL_PRICE } from "@/lib/products";
import { useCart } from "@/components/cart/cart-store";
import { scrollToAnchor } from "@/lib/home-anchors";

export function Hero() {
  const t = useTranslations("pages.home.hero");
  const [selected, setSelected] = useState(2); // Glow default
  const [paused, setPaused]     = useState(false);
  const product = NOVA_PRODUCTS[selected]!;

  useEffect(() => {
    if (paused) return;
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const id = setInterval(() => setSelected((s) => (s + 1) % NOVA_PRODUCTS.length), 5500);
    return () => clearInterval(id);
  }, [paused]);

  const handleSelect = (i: number) => { setPaused(true); setSelected(i); };

  const addPrimary = () => {
    useCart.getState().addItem(product, RETAIL_PRICE);
    useCart.getState().openDrawer();
  };

  const bg = `linear-gradient(160deg, ${product.ink} 0%, var(--navy) 75%)`;
  const glow = `radial-gradient(900px 600px at 75% 40%, ${product.color}55, transparent 60%)`;

  return (
    <section
      onFocus={() => setPaused(true)}
      style={{ background: bg, transition: "background 700ms cubic-bezier(0.22,1,0.36,1)" }}
      className="relative min-h-[100svh] overflow-hidden pt-24 pb-16"
    >
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: glow }} />
      {/* SVG turbulence overlay (mixBlendMode overlay, opacity 0.3) */}

      <div className="relative z-10 mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="inline-block rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-wider text-white/85">
            {t("pill", { name: product.name })}
          </span>
          <h1 className="mt-5 font-outfit font-black leading-[0.95] text-white"
              style={{ fontSize: "clamp(40px, 11vw, 86px)" }}>
            {t("title_a")} <br />
            <span className="font-newsreader italic font-normal" style={{ color: product.color, transition: "color 700ms" }}>
              {t("title_b_italic")}
            </span>{" "}
            <br />
            {t("title_c")}
          </h1>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={addPrimary}
              className="inline-flex items-center gap-2 rounded-full bg-coral px-6 py-3 text-base font-semibold text-white hover:bg-coral/90"
            >
              {t("cta_primary", { name: product.name, price: RETAIL_PRICE })}
            </button>
            <button
              type="button"
              onClick={() => scrollToAnchor("products")}
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3 text-base font-semibold text-white hover:bg-white/10"
            >
              {t("cta_secondary")}
            </button>
          </div>
        </div>

        {/* Right side: halo + float patch + orbiting ingredients (desktop) / 2-up-2-down (mobile). See spec §Hero · Layout */}
        <div className="relative h-[440px] lg:h-[560px]">
          <div aria-hidden className="absolute inset-0" /* halo / float keyframes: pulseHaloB 4s + floatPatchB 5s */ />
          <Image
            src={product.image}
            alt={product.name}
            priority
            fill
            sizes="(min-width:1024px) 50vw, 100vw"
            className="object-contain"
            style={{ filter: "drop-shadow(0 30px 60px rgba(0,0,0,0.4))" }}
          />
          {/* Orbiting ingredient chips — desktop radius 220px; mobile 2 above + 2 below */}
        </div>
      </div>

      {/* Selector — horizontal scroll-snap on mobile, centered row on desktop */}
      <div className="relative z-10 mt-12">
        <p className="px-4 text-center text-xs uppercase tracking-wider text-white/70">{t("selector_label")}</p>
        <div className="mt-4 flex gap-3 overflow-x-auto px-4 [scroll-snap-type:x_mandatory] lg:justify-center lg:overflow-visible">
          {NOVA_PRODUCTS.map((p, i) => (
            <button
              key={p.slug}
              type="button"
              aria-pressed={i === selected}
              aria-label={`Mostrar parche ${p.name}`}
              onClick={() => handleSelect(i)}
              className={`shrink-0 [scroll-snap-align:center] rounded-2xl px-4 py-3 text-sm transition ${
                i === selected ? "bg-white text-navy" : "bg-white/10 text-white/80 hover:bg-white/20"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes pulseHaloB { 0%,100% { transform: scale(1); opacity: .5 } 50% { transform: scale(1.06); opacity: .8 } }
        @keyframes floatPatchB { 0%,100% { transform: translateY(0) rotate(0) } 50% { transform: translateY(-14px) rotate(-2deg) } }
      `}</style>
    </section>
  );
}
```

- [ ] **Step 4: Run → PASS**, commit:

```bash
git add apps/web/src/components/home/hero.tsx apps/web/test/components/home/hero.test.tsx apps/web/messages/es.json
git commit -m "feat(home): add Hero section with patch selector and color-shift gradient"
```

---

## Task 9: HowItWorks section

**Files:**

- Create: `apps/web/src/components/home/how-it-works.tsx`
- Modify: `apps/web/messages/es.json` — add `pages.home.how_it_works.*`

See spec §2 for layout (mobile stack, desktop split with lifestyle photo right; 3 numbered step cards; floating chips on photo at top-left + bottom-right).

### Steps

- [ ] **Step 1: Add i18n keys** from spec §2.

- [ ] **Step 2: Implement `apps/web/src/components/home/how-it-works.tsx`** as a Client component:

```tsx
"use client";

import Image from "next/image";
import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";

const STEPS = [
  { n: "01", k: "1", color: "var(--coral)" },
  { n: "02", k: "2", color: "var(--teal)"  },
  { n: "03", k: "3", color: "var(--gold)"  },
] as const;

export function HowItWorks() {
  const t = useTranslations("pages.home.how_it_works");
  return (
    <section className="bg-cream py-20">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 lg:grid-cols-[1fr_1.05fr] lg:items-center">
        <div>
          <span className="text-xs uppercase tracking-wider text-coral">{t("eyebrow")}</span>
          <h2 className="mt-3 font-outfit text-4xl font-black leading-tight text-navy lg:text-6xl">
            {t("title_a")}{" "}
            <span className="font-newsreader italic font-normal text-coral">{t("title_b_italic")}</span>
          </h2>
          <p className="mt-5 max-w-md text-base text-navy/70">{t("lead")}</p>
          <ul className="mt-8 space-y-4">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-4 rounded-2xl bg-white p-5 shadow-sm">
                <span className="font-outfit text-2xl font-black" style={{ color: s.color }}>{s.n}</span>
                <div>
                  <p className="font-outfit text-lg font-black text-navy">{t(`steps.${s.k}.title`)}</p>
                  <p className="text-sm text-navy/70">{t(`steps.${s.k}.desc`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative aspect-[1/1.15] overflow-hidden rounded-[32px]" style={{ boxShadow: "0 30px 80px rgba(13,27,53,0.18)" }}>
          <Image src="/products/lifestyle-apply.webp" alt={t("photo_alt")} fill sizes="(min-width:1024px) 600px, 100vw" className="object-cover" />
          <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-navy">
            <span className="h-2 w-2 animate-pulse rounded-full bg-teal" /> {t("annotation_apply")}
          </div>
          <div className="absolute bottom-4 right-4 max-w-[220px] rounded-2xl bg-navy p-3 text-white">
            <Clock className="h-4 w-4" aria-hidden /> <span className="ml-2 text-sm font-bold">10–12h</span>
            <p className="text-xs text-white/80">{t("duration_label")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/home/how-it-works.tsx apps/web/messages/es.json
git commit -m "feat(home): add HowItWorks section with lifestyle photo and steps"
```

---

## Task 10: Absorption section + SkinDiagramC

**Files:**

- Create: `apps/web/src/components/home/absorption.tsx` (includes inline `SkinDiagramC` subcomponent)
- Modify: `apps/web/messages/es.json` — add `pages.home.absorption.*`

See spec §3 for full visuals: 4 SVG bands with wavy bottoms, 6 descending dots `nc-descend-c` keyframe (5s linear infinite, lateral positions `[22, 36, 52, 68, 82, 44]%`, delays `[0, 0.6, 1.4, 2.2, 3.1, 4.0]s`), yellow NOVAPATCH pill on top, 3 stat chips (`<500 Da` / `10–12 h` / `0 ×`), CTA "Encuentra tu parche" → `scrollToAnchor("products")`. Section id = `ciencia` (matches `HOME_ANCHORS.science`).

For the band path commands and exact Y offsets see `/tmp/np-design/novapatch-e-commerce/project/direction-c.jsx` lines ~210–280.

### Steps

- [ ] **Step 1: Add i18n keys** from spec §3.

- [ ] **Step 2: Implement `absorption.tsx`** as a Client component. Skeleton:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { scrollToAnchor } from "@/lib/home-anchors";

const STATS = ["size", "duration", "digestion"] as const;

export function Absorption() {
  const t = useTranslations("pages.home.absorption");
  return (
    <section id="ciencia" className="bg-[var(--cream-warm)] py-20">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 lg:grid-cols-[1fr_1.25fr] lg:items-center">
        <div>
          <span className="text-xs uppercase tracking-wider text-coral">{t("eyebrow")}</span>
          <h2 className="mt-3 font-outfit text-4xl font-black leading-tight text-navy lg:text-5xl">{t("title")}</h2>
          <p className="mt-5 text-base text-navy/70">{t("lead")}</p>

          <div className="mt-8 flex gap-3 overflow-x-auto pb-2 [scroll-snap-type:x_mandatory] lg:flex-wrap lg:overflow-visible">
            {STATS.map((k) => (
              <div key={k} className="min-w-[130px] shrink-0 [scroll-snap-align:start] rounded-2xl bg-white p-4 shadow-sm">
                <div className="font-outfit text-3xl font-black text-navy">
                  {t(`stats.${k}.value`)} <span className="text-base text-navy/60">{t(`stats.${k}.unit`)}</span>
                </div>
                <p className="text-xs text-navy/70">{t(`stats.${k}.label`)}</p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => scrollToAnchor("products")}
            className="mt-8 inline-flex rounded-full bg-coral px-6 py-3 text-base font-semibold text-white hover:bg-coral/90"
          >
            {t("cta")}
          </button>
        </div>

        <SkinDiagramC />
      </div>
    </section>
  );
}

function SkinDiagramC() {
  const t = useTranslations("pages.home.absorption.diagram");
  const dots = [
    { l: 22, d: 0    },
    { l: 36, d: 0.6  },
    { l: 52, d: 1.4  },
    { l: 68, d: 2.2  },
    { l: 82, d: 3.1  },
    { l: 44, d: 4.0  },
  ];

  return (
    <div className="relative max-w-[580px] rounded-3xl bg-[#EFE0D6] p-[18px]">
      <div className="rounded-full bg-[var(--gold)] px-4 py-2 text-center font-outfit text-sm font-black uppercase tracking-wide text-navy">
        {t("novapatch_label")}
      </div>
      <p className="mt-1 text-center text-xs text-navy/70">{t("novapatch_subtitle")}</p>

      {/* 4 stacked SVG bands with wavy bottoms — heights 76 / 92 / 124 / 80, see direction-c.jsx for path commands */}
      <div className="relative mt-4 h-[372px]">
        {/* SVG bands here */}
        {dots.map((d, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute top-0 h-2 w-2 rounded-full bg-[var(--coral)]"
            style={{ left: `${d.l}%`, animation: `nc-descend-c 5s linear ${d.d}s infinite` }}
          />
        ))}
      </div>
      <span className="absolute bottom-2 right-3 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-navy">{t("chip_daltons")}</span>

      <style jsx>{`
        @keyframes nc-descend-c {
          0%   { transform: translateY(0);   opacity: 1 }
          80%  { transform: translateY(330px); opacity: 1 }
          100% { transform: translateY(360px); opacity: 0 }
        }
      `}</style>
    </div>
  );
}
```

  Implement the 4 SVG bands fully using `direction-c.jsx:210-280` as the visual reference (corneo / epidermis / dermis / blood with arterial-curve coral paths).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/home/absorption.tsx apps/web/messages/es.json
git commit -m "feat(home): add Absorption section with animated skin diagram"
```

---

## Task 11: Comparison section (responsive: cards mobile / table desktop)

**Files:**

- Create: `apps/web/src/components/home/comparison.tsx` (Server component)
- Create: `apps/web/test/components/home/comparison.test.tsx`
- Modify: `apps/web/messages/es.json` — add `pages.home.comparison.*`

See spec §4. Detection of layout uses Tailwind responsive classes (`hidden md:grid` / `md:hidden`), NOT `matchMedia` — both layouts are rendered, CSS hides the unused one. Tests check that both blocks exist in the DOM.

Section id = `comparativa`.

### Steps

- [ ] **Step 1: Add i18n keys** from spec §4.

- [ ] **Step 2: Write failing test `apps/web/test/components/home/comparison.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/../messages/es.json";
import { Comparison } from "@/components/home/comparison";

const wrap = (ui: React.ReactNode) => (
  <NextIntlClientProvider locale="es" messages={messages}>{ui}</NextIntlClientProvider>
);

describe("Comparison", () => {
  it("renders mobile cards block (hidden on md+) with Novapatch winner first", () => {
    const { container } = render(wrap(<Comparison />));
    const mobile = container.querySelector("[data-layout='mobile']");
    expect(mobile).toBeTruthy();
    expect(mobile?.className).toMatch(/md:hidden/);
    expect(mobile?.firstElementChild?.textContent).toMatch(/Novapatch/);
  });

  it("renders desktop table grid block hidden below md", () => {
    const { container } = render(wrap(<Comparison />));
    const desktop = container.querySelector("[data-layout='desktop']");
    expect(desktop).toBeTruthy();
    expect(desktop?.className).toMatch(/hidden md:grid/);
  });

  it("renders the eyebrow and italic title fragment", () => {
    render(wrap(<Comparison />));
    expect(screen.getByText("Comparativa")).toBeInTheDocument();
    expect(screen.getByText("o parche?")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Implement `apps/web/src/components/home/comparison.tsx`** as a Server component:

```tsx
import { getTranslations } from "next-intl/server";

const ROWS = ["absorption", "release", "no_liver", "no_sugar", "no_water", "no_forgetting"] as const;
const COLUMNS = ["novapatch", "capsules", "gummies"] as const;

// Boolean-or-string per column for each row.
type Cell = boolean | string;
const CELLS: Record<typeof ROWS[number], [Cell, Cell, Cell]> = {
  absorption:    ["90%",   "10–20%", "10–20%"],
  release:       ["10–12h","2–4h",   "2–4h"],
  no_liver:      [true,    false,    false],
  no_sugar:      [true,    true,     false],
  no_water:      [true,    false,    false],
  no_forgetting: [true,    false,    false],
};

interface ComparisonProps { locale?: string }

export async function Comparison({ locale = "es" }: ComparisonProps) {
  const t = await getTranslations({ locale, namespace: "pages.home.comparison" });
  const renderCell = (v: Cell): string =>
    v === true ? "✓" : v === false ? "✗" : v;

  return (
    <section id="comparativa" className="bg-cream py-20">
      <div className="mx-auto max-w-6xl px-4">
        <span className="text-xs uppercase tracking-wider text-coral">{t("eyebrow")}</span>
        <h2 className="mt-3 font-outfit text-4xl font-black leading-tight text-navy lg:text-5xl">
          {t("title_a")} <span className="font-newsreader italic font-normal text-coral">{t("title_b_italic")}</span>
        </h2>
        <p className="mt-3 text-navy/70">{t("lead")}</p>

        {/* Mobile cards */}
        <div data-layout="mobile" className="mt-10 space-y-4 md:hidden">
          {COLUMNS.map((col, i) => (
            <article
              key={col}
              className={i === 0
                ? "rounded-3xl bg-navy p-6 text-white"
                : "rounded-3xl border border-navy/10 bg-white p-6 text-navy"}
            >
              <div className="flex items-center gap-2">
                {i === 0 && <span className="rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold uppercase">{t("winner_badge")}</span>}
                <h3 className="font-outfit text-xl font-black">{t(`columns.${col}.name`)}</h3>
              </div>
              <p className="text-sm opacity-70">{t(`columns.${col}.sub`)}</p>
              <dl className="mt-4 space-y-2 text-sm">
                {ROWS.map((r) => (
                  <div key={r} className="flex justify-between border-t border-current/10 pt-2">
                    <dt className="opacity-70">{t(`rows.${r}`)}</dt>
                    <dd className="font-semibold">{renderCell(CELLS[r][i] as Cell)}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>

        {/* Desktop table grid */}
        <div data-layout="desktop" className="mt-10 hidden md:grid" style={{ gridTemplateColumns: "1.6fr 1.1fr 1fr 1fr" }}>
          <div /> {/* corner spacer */}
          {COLUMNS.map((col, i) => (
            <div
              key={col}
              className={`relative px-4 pb-4 text-center ${i === 0 ? "bg-[rgba(248,237,235,0.35)] rounded-t-2xl" : ""}`}
            >
              {i === 0 && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-coral px-3 py-1 text-[10px] font-bold uppercase text-white">{t("winner_badge")}</span>}
              <p className="font-outfit text-lg font-black text-navy">{t(`columns.${col}.name`)}</p>
              <p className="text-xs text-navy/60">{t(`columns.${col}.sub`)}</p>
            </div>
          ))}

          {ROWS.map((r) => (
            <div key={r} className="contents">
              <div className="border-t border-navy/10 px-4 py-3 text-sm text-navy/70">{t(`rows.${r}`)}</div>
              {COLUMNS.map((_, i) => {
                const v = CELLS[r][i] as Cell;
                const cls = i === 0 ? "bg-[rgba(248,237,235,0.35)]" : "";
                return (
                  <div key={i} className={`border-t border-navy/10 px-4 py-3 text-center text-sm ${cls}`}>
                    {typeof v === "boolean" ? (
                      <span
                        aria-hidden
                        className={`inline-grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${
                          v ? "bg-coral text-white" : "bg-navy/10 text-navy/40"
                        }`}
                      >
                        {v ? "✓" : "✗"}
                      </span>
                    ) : (
                      <span className="font-semibold text-navy">{v}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run → PASS**, commit:

```bash
cd apps/web && bun test test/components/home/comparison.test.tsx
git add apps/web/src/components/home/comparison.tsx apps/web/test/components/home/comparison.test.tsx apps/web/messages/es.json
git commit -m "feat(home): add Comparison section with responsive cards/table"
```

---

## Task 12: ProductGrid + ProductCard (TDD)

**Files:**

- Create: `apps/web/src/components/home/product-grid.tsx`
- Create: `apps/web/test/components/home/product-grid.test.tsx`
- Modify: `apps/web/messages/es.json` — add `pages.home.product_grid.*`

See spec §5 for card structure, hover behavior (desktop only via `@media (hover: hover)`), popular badge, ingredient chip reveal. Section id = `productos`.

### Steps

- [ ] **Step 1: Add i18n keys** from spec §5.

- [ ] **Step 2: Write failing test `apps/web/test/components/home/product-grid.test.tsx`**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/../messages/es.json";
import { ProductGrid } from "@/components/home/product-grid";
import { useCart } from "@/components/cart/cart-store";

const wrap = (ui: React.ReactNode) => (
  <NextIntlClientProvider locale="es" messages={messages}>{ui}</NextIntlClientProvider>
);

beforeEach(() => {
  localStorage.clear();
  useCart.setState({ items: [], drawerOpen: false, hydrated: true });
});

describe("ProductGrid", () => {
  it("renders 6 cards in canonical order", () => {
    render(wrap(<ProductGrid />));
    const names = screen.getAllByTestId("pcard-name").map((n) => n.textContent);
    expect(names).toEqual(["Energy", "Sleep", "Glow", "Shield", "Zen", "Woman"]);
  });

  it('shows "Popular" badge only on Glow', () => {
    render(wrap(<ProductGrid />));
    const badges = screen.getAllByText("Popular");
    expect(badges).toHaveLength(1);
    const card = badges[0]?.closest("[data-slug]");
    expect(card?.getAttribute("data-slug")).toBe("glow");
  });

  it('clicking "Agregar" adds the product at $750 and opens drawer', () => {
    render(wrap(<ProductGrid />));
    const energyCard = screen.getByTestId("pcard-energy");
    fireEvent.click(energyCard.querySelector("button")!);
    expect(useCart.getState().items[0]).toMatchObject({ slug: "energy", price: 750, qty: 1 });
    expect(useCart.getState().drawerOpen).toBe(true);
  });

  it('section anchor has id="productos"', () => {
    const { container } = render(wrap(<ProductGrid />));
    expect(container.querySelector("section#productos")).toBeTruthy();
  });
});
```

- [ ] **Step 3: Implement `apps/web/src/components/home/product-grid.tsx`** (Client). Skeleton:

```tsx
"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { NOVA_PRODUCTS, RETAIL_PRICE, type ProductMeta } from "@/lib/products";
import { useCart } from "@/components/cart/cart-store";

export function ProductGrid() {
  const t = useTranslations("pages.home.product_grid");
  return (
    <section id="productos" className="bg-cream py-20">
      <div className="mx-auto max-w-6xl px-4">
        <span className="text-xs uppercase tracking-wider text-coral">{t("eyebrow")}</span>
        <h2 className="mt-3 font-outfit text-4xl font-black leading-tight text-navy lg:text-5xl">
          {t("title_a")}{" "}
          <span className="font-newsreader italic font-normal text-coral">{t("title_b_italic")}</span>
        </h2>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {NOVA_PRODUCTS.map((p) => (
            <ProductCard key={p.slug} p={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductCard({ p }: { p: ProductMeta }) {
  const t = useTranslations("pages.home.product_grid.card");
  const onAdd = () => {
    useCart.getState().addItem(p, RETAIL_PRICE);
    useCart.getState().openDrawer();
  };
  return (
    <article
      data-slug={p.slug}
      data-testid={`pcard-${p.slug}`}
      className="group relative overflow-hidden rounded-3xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
    >
      <div
        className="relative aspect-[1/1.05] overflow-hidden"
        style={{ background: `radial-gradient(60% 60% at 50% 40%, ${p.color}55, ${p.bg})` }}
      >
        {p.popular && (
          <span className="absolute left-3 top-3 rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            {t("popular")}
          </span>
        )}
        <Image
          src={p.image}
          alt={p.name}
          fill
          loading="lazy"
          sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw"
          className="object-contain p-8 transition-transform duration-500 [@media(hover:hover)]:group-hover:scale-105 [@media(hover:hover)]:group-hover:-rotate-2"
        />
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap gap-1 opacity-0 transition-opacity [@media(hover:hover)]:group-hover:opacity-100">
          {p.ingredients.slice(0, 3).map((ing) => (
            <span key={ing} className="rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-navy">{ing}</span>
          ))}
          {p.ingredients.length > 3 && (
            <span className="rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-navy">+{p.ingredients.length - 3}</span>
          )}
        </div>
      </div>

      <div className="p-5">
        <p data-testid="pcard-name" className="font-outfit text-2xl font-black text-navy">{p.name}</p>
        <p className="text-sm text-navy/70">{p.tagline} · {t("units_short")}</p>
        <hr className="my-3 border-navy/10" />
        <div className="flex items-center justify-between">
          <div>
            <p className="font-outfit text-xl font-black text-navy">${RETAIL_PRICE}</p>
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
    </article>
  );
}
```

- [ ] **Step 4: Run → PASS**, commit:

```bash
cd apps/web && bun test test/components/home/product-grid.test.tsx
git add apps/web/src/components/home/product-grid.tsx apps/web/test/components/home/product-grid.test.tsx apps/web/messages/es.json
git commit -m "feat(home): add ProductGrid with one-time add-to-bag wired to cart"
```

---

## Task 13: SubscriptionTeaser

**Files:**

- Create: `apps/web/src/components/home/subscription-teaser.tsx` (Server)
- Modify: `apps/web/messages/es.json` — add `pages.home.subscription_teaser.*`

See spec §6: navy gradient card, copy left + 3 frequency tiers right (20/15/10), CTA "Suscríbete y ahorra" → `scrollToAnchor("products")` (must be a Client wrapper for the click; or render a `<a href="#productos">` to keep this Server). Plan choice: keep Server, use `<a href="#productos">` for SSR-friendly anchor scroll (browsers handle `:target` smooth scroll well; or rely on global CSS `scroll-behavior: smooth` from Plan #2).

### Steps

- [ ] **Step 1: Add i18n keys** from spec §6.

- [ ] **Step 2: Implement `apps/web/src/components/home/subscription-teaser.tsx`**:

```tsx
import { getTranslations } from "next-intl/server";

const TIERS = [
  { days: 30, off: 20, color: "var(--teal)", k: "30" as const },
  { days: 60, off: 15, color: "var(--sky)",  k: "60" as const },
  { days: 90, off: 10, color: "var(--gold)", k: "90" as const },
];

interface SubscriptionTeaserProps { locale?: string }

export async function SubscriptionTeaser({ locale = "es" }: SubscriptionTeaserProps) {
  const t = await getTranslations({ locale, namespace: "pages.home.subscription_teaser" });
  return (
    <section className="px-4 py-20">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[40px] p-10 lg:p-16"
           style={{ background: "linear-gradient(135deg, #0D1B35 0%, #1A2D4D 100%)" }}>
        <div aria-hidden className="pointer-events-none absolute inset-0"
             style={{ background: "radial-gradient(700px 400px at 20% 30%, rgba(242,92,84,0.18), transparent 60%), radial-gradient(700px 400px at 80% 80%, rgba(30,177,188,0.18), transparent 60%)" }} />
        <div className="relative grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <span className="text-xs uppercase tracking-wider text-coral">{t("eyebrow")}</span>
            <h2 className="mt-3 font-outfit text-4xl font-black text-white lg:text-5xl">
              {t("title_a")} <span className="font-newsreader italic font-normal text-[var(--gold)]">{t("title_b_italic")}</span>
            </h2>
            <p className="mt-4 max-w-md text-white/80">{t("lead")}</p>
            <a
              href="#productos"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-coral px-6 py-3 text-base font-semibold text-white hover:bg-coral/90"
            >
              {t("cta")} →
            </a>
            <p className="mt-3 text-xs text-white/60">{t("no_commitment")}</p>
          </div>

          <ul className="space-y-3">
            {TIERS.map((tier) => (
              <li key={tier.k} className="flex items-center justify-between rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <div>
                  <p className="font-outfit text-lg font-black text-white">{t(`tiers.${tier.k}.freq`)}</p>
                  <p className="text-xs text-white/60">{t(`tiers.${tier.k}.tag`)}</p>
                </div>
                <span
                  className="rounded-full px-3 py-1 font-outfit text-sm font-black"
                  style={{ background: tier.color, color: "var(--navy)" }}
                >
                  {t("discount_format", { percent: tier.off })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/home/subscription-teaser.tsx apps/web/messages/es.json
git commit -m "feat(home): add SubscriptionTeaser with 20/15/10 tier display"
```

---

## Task 14: FinalCTA

**Files:**

- Create: `apps/web/src/components/home/final-cta.tsx` (Client — onClick scroll handler)
- Modify: `apps/web/messages/es.json` — add `pages.home.final_cta.*`

See spec §7. No quiz button per Q5.

### Steps

- [ ] **Step 1: Add i18n keys** from spec §7.

- [ ] **Step 2: Implement** `apps/web/src/components/home/final-cta.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { scrollToAnchor } from "@/lib/home-anchors";

export function FinalCTA() {
  const t = useTranslations("pages.home.final_cta");
  return (
    <section className="relative overflow-hidden bg-navy py-24 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-0"
           style={{ background: "radial-gradient(700px 400px at 30% 30%, rgba(242,92,84,0.18), transparent 60%), radial-gradient(700px 400px at 70% 70%, rgba(30,177,188,0.18), transparent 60%)" }} />
      <div className="relative mx-auto max-w-3xl px-4">
        <h2 className="font-outfit text-4xl font-black text-white lg:text-6xl">
          {t("title_a")}{" "}
          <span className="font-newsreader italic font-normal text-[var(--gold)]">{t("title_b_italic")}</span>.
        </h2>
        <p className="mt-4 text-white/80">{t("lead")}</p>
        <button
          type="button"
          onClick={() => scrollToAnchor("products")}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-coral px-8 py-4 text-lg font-semibold text-white hover:bg-coral/90"
        >
          {t("cta")} →
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/home/final-cta.tsx apps/web/messages/es.json
git commit -m "feat(home): add FinalCTA navy section with single ritual CTA"
```

---

## Task 15: Wire `/[locale]/page.tsx` to compose all home sections

**Files:**

- Modify: `apps/web/src/app/[locale]/page.tsx`

### Steps

- [ ] **Step 1: Read current page** to capture any existing copy / metadata to preserve.

- [ ] **Step 2: Replace contents** with the home composition:

```tsx
import { Hero } from "@/components/home/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { Absorption } from "@/components/home/absorption";
import { Comparison } from "@/components/home/comparison";
import { ProductGrid } from "@/components/home/product-grid";
import { SubscriptionTeaser } from "@/components/home/subscription-teaser";
import { FinalCTA } from "@/components/home/final-cta";

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  return (
    <>
      <Hero />
      <HowItWorks />
      <Absorption />
      {/* Server component — pass locale explicitly */}
      <Comparison locale={locale} />
      <ProductGrid />
      <SubscriptionTeaser locale={locale} />
      <FinalCTA />
    </>
  );
}
```

  Note: `<Navbar/>` and `<Footer/>` are mounted in `apps/web/src/app/[locale]/layout.tsx` (already in the project). Confirm Footer is the rewritten one from Task 7.

- [ ] **Step 3: Verify** — run dev server, smoke-test the page renders all sections and i18n keys resolve:

```bash
cd apps/web && bun run typecheck && bun run lint && bun test
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/[locale]/page.tsx
git commit -m "feat(home): compose Direction C sections on /[locale] route"
```

---

## Task 16: E2E Playwright happy path

**Files:**

- Create: `apps/web/e2e/home-cart.spec.ts`
- Modify: `apps/web/playwright.config.ts` (verify; add if missing)
- Modify: `apps/web/package.json` (verify `test:e2e` script)

### Steps

- [ ] **Step 1: Confirm Playwright is installed**. If not:

```bash
cd apps/web && bun add -D @playwright/test && bunx playwright install chromium
```

  Confirm `playwright.config.ts` exists with `webServer: { command: "bun run dev", url: "http://localhost:3000", reuseExistingServer: true }` and `testDir: "./e2e"`. Add if missing.

- [ ] **Step 2: Write `apps/web/e2e/home-cart.spec.ts`**:

```ts
import { test, expect } from "@playwright/test";

test.describe("Home + cart happy path", () => {
  test("hero, selector, add to bag, persistence, clear, newsletter", async ({ page }) => {
    // Mock the waitlist endpoint
    await page.route("**/waitlist", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) }),
    );

    await page.goto("/es");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Click Energy in selector (auto-rotation will pause)
    await page.getByRole("button", { name: /Mostrar parche Energy/i }).click();
    await expect(page.getByRole("button", { name: /Mostrar parche Energy/i })).toHaveAttribute("aria-pressed", "true");

    // Click Agregar on Energy product card
    await page.getByTestId("pcard-energy").getByRole("button", { name: /Agregar/i }).click();
    await expect(page.getByText("Tu bolsa")).toBeVisible();
    await expect(page.getByText("Energy")).toBeVisible();

    // Close drawer (Escape)
    await page.keyboard.press("Escape");

    // Reopen via nav cart button
    await page.getByRole("button", { name: /Bolsa, 1 parche/ }).click();
    await expect(page.getByText("Energy")).toBeVisible();

    // Reload and confirm persistence
    await page.reload();
    await page.getByRole("button", { name: /Bolsa, 1 parche/ }).click();
    await expect(page.getByText("Energy")).toBeVisible();

    // Clear cart
    await page.getByRole("button", { name: "Vaciar bolsa" }).click();
    await expect(page.getByText("Tu bolsa está vacía")).toBeVisible();

    // Close drawer + scroll to footer + submit newsletter
    await page.keyboard.press("Escape");
    await page.getByPlaceholder("tu@correo.com").fill("test-home@example.com");
    await page.getByRole("button", { name: "Suscribirse" }).click();
    await expect(page.getByText(/Te suscribimos/)).toBeVisible();
  });
});
```

- [ ] **Step 3: Run E2E** (must succeed locally; if dev server is not running, Playwright's `webServer` will spin one up):

```bash
cd apps/web && bun run test:e2e
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/e2e/home-cart.spec.ts apps/web/playwright.config.ts apps/web/package.json
git commit -m "test(home): add Playwright happy-path covering hero, cart persistence, newsletter"
```

---

## Task 17: Update ROADMAP.md

**Files:**

- Modify: `docs/superpowers/ROADMAP.md`

### Steps

- [ ] **Step 1: Read current ROADMAP** to understand format.

- [ ] **Step 2: Edit** to reflect:

  - Plan #4 (this plan) = Home (Direction C) + Cart store + Drawer
  - Plan #4b (new) = Tienda grid page + PDP (per-product detail) — uses `NOVA_PRODUCTS`, `useCart`, `<CartDrawer />` from Plan #4
  - Plan #7 (Plan Builder) note: replaces SubscriptionTeaser CTA copy + href to point to `/plan-builder`

  Also update the "open questions" / "scope changes" history to note the swap on 2026-04-27.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/ROADMAP.md
git commit -m "docs(roadmap): swap Plan #4 to Home, add Plan #4b for Tienda+PDP"
```

---

## Self-review

- **Spec coverage:** every spec section maps to a task — §Architecture/§Data model → Task 1; §Cart store → Task 2; §Sections 1–7 → Tasks 8–14; §8 Navbar → Task 6; §9 Footer → Task 7; §10 CartDrawer → Tasks 3–5; §Performance / §Accessibility / §Testing → addressed inside the relevant tasks (priority hero image in Task 8, lazy product images in Task 12, hydration-safe count in Task 3, focus-pause in Task 8, prefers-reduced-motion guard in Task 8 + Task 10 keyframes, Vitest tests inline in Tasks 2/3/4/6/7/8/11/12, Playwright in Task 16).
- **No placeholders** — every imported symbol and every i18n key referenced is created in the same task or a clearly-numbered earlier task.
- **Type / method consistency:** `addItem(p, RETAIL_PRICE)` signature is identical across Hero (Task 8), ProductGrid (Task 12), and Cart store tests (Task 2). `scrollToAnchor("products")` uses the same `HomeAnchor` literal in Hero, Absorption, FinalCTA, SubscriptionTeaser anchor, and the cart drawer empty-state CTA. Anchor IDs (`productos` / `ciencia` / `comparativa`) match between `lib/home-anchors.ts`, the Navbar, and each section's `<section id>`.
- **Project constraints respected:** `exactOptionalPropertyTypes` handled via conditional spread in Navbar (Task 6); Newsreader italic via `font-newsreader italic font-normal`; design tokens via `var(--coral)` etc.; per-product colors stay hardcoded in `lib/products.ts`; unique CSS keyframe names (`nc-descend-c`, `pulseHaloB`, `floatPatchB`).
- **Commit hygiene:** every task ends with a single conventional commit. No `git add -A` or wildcard adds.

---

**Execution handoff:** Which mode would you like to use to execute this plan?

1. **Subagent-Driven Development (recommended)** — `superpowers:subagent-driven-development`. Each task ships in its own subagent, with review checkpoints after each commit. Best for plans with independent component tasks like this one.
2. **Executing Plans** — `superpowers:executing-plans`. Single-session execution of the entire plan. Faster but no inter-task review.

Default to (1) unless you say otherwise.
