# Foundation + Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Novapatch v2 monorepo with `packages/markets`, `packages/catalog`, and an `apps/api` Hono server exposing a tested `GET /catalog` endpoint driven by static product data and market-resolved prices.

**Architecture:** pnpm workspace monorepo. Two packages (`markets`, `catalog`) hold pure, strongly-typed config and pricing helpers consumed by both frontend and backend. One app (`api`) — a Bun-powered Hono server — reads from the packages, applies market resolution via middleware, and returns catalog data. Every step is TDD: failing test → minimal code → green → refactor → commit.

**Tech Stack:** Bun 1.x · Hono · TypeScript 5 · Zod · pnpm workspaces · `bun:test`

**Scope of this plan (explicit):**
- DB (Drizzle + Postgres), Clerk auth, discounts, checkout, jobs, admin, webhooks — deferred to later plans.
- This plan produces a running HTTP API with a tested catalog endpoint; no persistence yet.

---

## File Structure

```
novapatchv2/
├── package.json                      # root — pnpm workspace glue, shared scripts
├── pnpm-workspace.yaml               # workspace declaration
├── tsconfig.base.json                # shared TS compiler options (strict)
├── .gitignore                        # node_modules, dist, .env, etc.
├── .nvmrc                            # pin node engine (for dev tools)
├── README.md                         # 1-paragraph project intro
├── apps/
│   └── api/
│       ├── package.json              # hono, zod, @hono/zod-validator, bun
│       ├── tsconfig.json             # extends root base
│       ├── src/
│       │   ├── index.ts              # Hono app wiring (exports `app`, starts server)
│       │   ├── server.ts             # thin entrypoint — imports app, calls Bun.serve
│       │   ├── middleware/
│       │   │   └── market.ts         # resolves ?market= query to Market config
│       │   ├── routes/
│       │   │   ├── health.ts         # GET /health
│       │   │   └── catalog.ts        # GET /catalog, GET /catalog/:slug
│       │   └── env.ts                # typed env reader (PORT, etc.)
│       └── test/
│           ├── health.test.ts
│           ├── catalog.test.ts
│           └── middleware/
│               └── market.test.ts
└── packages/
    ├── markets/
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── src/
    │   │   ├── index.ts              # MARKETS constant + types + resolveMarket()
    │   │   └── types.ts              # Market, MarketId types
    │   └── test/
    │       └── markets.test.ts
    └── catalog/
        ├── package.json
        ├── tsconfig.json
        ├── src/
        │   ├── index.ts              # re-exports public API
        │   ├── products.ts           # PRODUCTS record — 6 initial SKUs
        │   ├── types.ts              # Product, ProductSlug, SubscriptionInterval
        │   └── pricing.ts            # getPriceForMarket, getSubscriptionPrice helpers
        └── test/
            ├── products.test.ts
            └── pricing.test.ts
```

**File responsibilities:**
- `packages/markets` owns currency, tax rate, shipping flat, and payment provider per country. Pure data + one resolver. No runtime dependencies.
- `packages/catalog` owns the 6 SKU definitions, their per-market base prices, and pricing helpers (apply frequency discount, resolve MSRP for a market).
- `apps/api` composes Hono + middleware + routes. `index.ts` exports the built `app` (so tests can `app.fetch()` without a port); `server.ts` is the thin entrypoint that actually binds a port.
- Tests live next to the app/package they cover in a `test/` folder to mirror `src/`.

---

## Task 1: Monorepo Bootstrap

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.nvmrc`
- Create: `README.md`

- [ ] **Step 1.1: Verify Bun and pnpm are installed**

Run: `bun --version && pnpm --version`
Expected: prints two version strings. If either is missing, install — Bun via `curl -fsSL https://bun.sh/install | bash`, pnpm via `npm i -g pnpm`.

- [ ] **Step 1.2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 1.3: Create root `package.json`**

```json
{
  "name": "novapatchv2",
  "private": true,
  "version": "0.0.0",
  "packageManager": "pnpm@9.0.0",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "dev": "pnpm --filter @novapatch/api dev",
    "test": "pnpm -r test",
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "typescript": "^5.6.2",
    "@types/node": "^20.12.0"
  }
}
```

- [ ] **Step 1.4: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["bun-types"]
  }
}
```

- [ ] **Step 1.5: Create `.gitignore`**

```
node_modules
dist
.env
.env.local
*.log
.DS_Store
coverage
.turbo
```

- [ ] **Step 1.6: Create `.nvmrc`**

```
20
```

- [ ] **Step 1.7: Create `README.md`**

```markdown
# Novapatch v2

Subscription e-commerce backend + storefront for Novapatch vitamin patches (Mexico + LATAM).

## Structure

- `apps/api` — Hono + Bun backend
- `apps/web` — Next.js storefront (added in a later plan)
- `packages/markets` — market config (currency, tax, payment provider)
- `packages/catalog` — static product catalog + pricing helpers

## Development

    pnpm install
    pnpm test
    pnpm dev
```

- [ ] **Step 1.8: Install root dev dependencies**

Run: `pnpm install`
Expected: creates `node_modules/` and `pnpm-lock.yaml` with typescript and @types/node installed.

- [ ] **Step 1.9: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore .nvmrc README.md pnpm-lock.yaml
git commit -m "chore: bootstrap pnpm workspace monorepo"
```

---

## Task 2: `packages/markets` — Market Config (TDD)

**Files:**
- Create: `packages/markets/package.json`
- Create: `packages/markets/tsconfig.json`
- Create: `packages/markets/src/types.ts`
- Create: `packages/markets/src/index.ts`
- Create: `packages/markets/test/markets.test.ts`

- [ ] **Step 2.1: Create `packages/markets/package.json`**

```json
{
  "name": "@novapatch/markets",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "build": "echo 'source-exported, no build step'"
  },
  "devDependencies": {
    "bun-types": "^1.1.0",
    "typescript": "^5.6.2"
  }
}
```

- [ ] **Step 2.2: Create `packages/markets/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 2.3: Install package deps**

Run: `pnpm install`
Expected: updates lockfile, installs `bun-types` in the markets package.

- [ ] **Step 2.4: Write failing test for `MARKETS` export**

Create `packages/markets/test/markets.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { MARKETS } from "../src/index";

describe("MARKETS", () => {
  it("defines all 5 LATAM markets", () => {
    expect(Object.keys(MARKETS).sort()).toEqual(["ar", "br", "cl", "co", "mx"]);
  });

  it("MX uses openpay and MXN", () => {
    expect(MARKETS.mx.currency).toBe("MXN");
    expect(MARKETS.mx.paymentProvider).toBe("openpay");
    expect(MARKETS.mx.taxRate).toBe(0.16);
  });

  it("non-MX markets use mercadopago", () => {
    for (const id of ["br", "ar", "cl", "co"] as const) {
      expect(MARKETS[id].paymentProvider).toBe("mercadopago");
    }
  });

  it("every market has integer shippingFlat in cents", () => {
    for (const id of Object.keys(MARKETS) as (keyof typeof MARKETS)[]) {
      expect(Number.isInteger(MARKETS[id].shippingFlat)).toBe(true);
      expect(MARKETS[id].shippingFlat).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2.5: Run the test — verify it fails**

Run: `pnpm --filter @novapatch/markets test`
Expected: FAIL — "Cannot find module '../src/index'" or equivalent.

- [ ] **Step 2.6: Create `packages/markets/src/types.ts`**

```typescript
export type MarketId = "mx" | "br" | "ar" | "cl" | "co";

export type PaymentProvider = "openpay" | "mercadopago";

export interface Market {
  id: MarketId;
  currency: string;       // ISO 4217
  locale: string;         // BCP 47 (e.g. "es-MX")
  paymentProvider: PaymentProvider;
  taxRate: number;        // decimal (0.16 = 16%)
  shippingFlat: number;   // cents in market's currency
}
```

- [ ] **Step 2.7: Create `packages/markets/src/index.ts`**

```typescript
import type { Market, MarketId } from "./types";

export * from "./types";

export const MARKETS: Record<MarketId, Market> = {
  mx: {
    id: "mx",
    currency: "MXN",
    locale: "es-MX",
    paymentProvider: "openpay",
    taxRate: 0.16,
    shippingFlat: 8500, // $85.00 MXN
  },
  br: {
    id: "br",
    currency: "BRL",
    locale: "pt-BR",
    paymentProvider: "mercadopago",
    taxRate: 0.17,
    shippingFlat: 2500,
  },
  ar: {
    id: "ar",
    currency: "ARS",
    locale: "es-AR",
    paymentProvider: "mercadopago",
    taxRate: 0.21,
    shippingFlat: 300000,
  },
  cl: {
    id: "cl",
    currency: "CLP",
    locale: "es-CL",
    paymentProvider: "mercadopago",
    taxRate: 0.19,
    shippingFlat: 500000,
  },
  co: {
    id: "co",
    currency: "COP",
    locale: "es-CO",
    paymentProvider: "mercadopago",
    taxRate: 0.19,
    shippingFlat: 2000000,
  },
};
```

> **Note:** `taxRate` and `shippingFlat` values reflect common in-market defaults and are initial MSRP. Confirm with finance/ops before launch per market.

- [ ] **Step 2.8: Run the test — verify it passes**

Run: `pnpm --filter @novapatch/markets test`
Expected: PASS — 4 passing assertions.

- [ ] **Step 2.9: Write failing test for `resolveMarket`**

Append to `packages/markets/test/markets.test.ts`:

```typescript
import { resolveMarket, isMarketId } from "../src/index";

describe("resolveMarket", () => {
  it("returns market for valid id", () => {
    const m = resolveMarket("mx");
    expect(m.currency).toBe("MXN");
  });

  it("is case-insensitive", () => {
    const m = resolveMarket("MX");
    expect(m.id).toBe("mx");
  });

  it("throws for invalid id", () => {
    expect(() => resolveMarket("us")).toThrow(/unknown market/i);
  });
});

describe("isMarketId", () => {
  it("true for known market ids", () => {
    expect(isMarketId("mx")).toBe(true);
  });

  it("false for unknown strings", () => {
    expect(isMarketId("us")).toBe(false);
    expect(isMarketId("")).toBe(false);
  });
});
```

- [ ] **Step 2.10: Run — verify the new block fails**

Run: `pnpm --filter @novapatch/markets test`
Expected: FAIL — "resolveMarket is not defined" / "isMarketId is not defined".

- [ ] **Step 2.11: Add `resolveMarket` and `isMarketId` to `packages/markets/src/index.ts`**

Append to the file:

```typescript
const MARKET_IDS = Object.keys(MARKETS) as MarketId[];

export function isMarketId(value: unknown): value is MarketId {
  return typeof value === "string" && (MARKET_IDS as string[]).includes(value.toLowerCase());
}

export function resolveMarket(value: string): Market {
  const lower = value.toLowerCase();
  if (!isMarketId(lower)) {
    throw new Error(`unknown market: ${value}`);
  }
  return MARKETS[lower];
}
```

- [ ] **Step 2.12: Run — verify all tests pass**

Run: `pnpm --filter @novapatch/markets test`
Expected: PASS — 7 assertions.

- [ ] **Step 2.13: Run typecheck**

Run: `pnpm --filter @novapatch/markets typecheck`
Expected: no output (success).

- [ ] **Step 2.14: Commit**

```bash
git add packages/markets pnpm-lock.yaml
git commit -m "feat(markets): MARKETS config + resolveMarket helper with tests"
```

---

## Task 3: `packages/catalog` — Product Catalog (TDD)

**Files:**
- Create: `packages/catalog/package.json`
- Create: `packages/catalog/tsconfig.json`
- Create: `packages/catalog/src/types.ts`
- Create: `packages/catalog/src/products.ts`
- Create: `packages/catalog/src/pricing.ts`
- Create: `packages/catalog/src/index.ts`
- Create: `packages/catalog/test/products.test.ts`
- Create: `packages/catalog/test/pricing.test.ts`

- [ ] **Step 3.1: Create `packages/catalog/package.json`**

```json
{
  "name": "@novapatch/catalog",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "build": "echo 'source-exported, no build step'"
  },
  "dependencies": {
    "@novapatch/markets": "workspace:*"
  },
  "devDependencies": {
    "bun-types": "^1.1.0",
    "typescript": "^5.6.2"
  }
}
```

- [ ] **Step 3.2: Create `packages/catalog/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 3.3: Install deps**

Run: `pnpm install`
Expected: links `@novapatch/markets` into the catalog package via workspace protocol.

- [ ] **Step 3.4: Create `packages/catalog/src/types.ts`**

```typescript
import type { MarketId } from "@novapatch/markets";

export type ProductSlug =
  | "energy"
  | "sleep"
  | "glow"
  | "shield"
  | "zen"
  | "woman";

export type SubscriptionInterval = 30 | 60 | 90;

export interface Product {
  slug: ProductSlug;
  name: string;
  description: string;
  images: string[];
  basePrice: Record<MarketId, number>;      // cents in market currency
  isStockable: boolean;
  subscriptionDiscounts: Record<SubscriptionInterval, number>; // integer % off
}

export const DISPLAY_ORDER: readonly ProductSlug[] = [
  "energy",
  "sleep",
  "glow",
  "shield",
  "zen",
  "woman",
] as const;
```

- [ ] **Step 3.5: Create `packages/catalog/src/products.ts`**

> **Note:** the MSRP numbers below are initial defaults (cents in each market's currency). They are the structure the code needs; confirm the exact retail prices with the product owner before launch.

```typescript
import type { Product } from "./types";

export const PRODUCTS: Record<Product["slug"], Product> = {
  energy: {
    slug: "energy",
    name: "Energy",
    description: "Parche vitamínico para energía sostenida durante el día.",
    images: ["/products/energy-1.webp"],
    basePrice: { mx: 45000, br: 8900, ar: 1200000, cl: 3500000, co: 13000000 },
    isStockable: true,
    subscriptionDiscounts: { 30: 20, 60: 15, 90: 10 },
  },
  sleep: {
    slug: "sleep",
    name: "Sleep",
    description: "Parche nocturno con melatonina y magnesio para descanso profundo.",
    images: ["/products/sleep-1.webp"],
    basePrice: { mx: 45000, br: 8900, ar: 1200000, cl: 3500000, co: 13000000 },
    isStockable: true,
    subscriptionDiscounts: { 30: 20, 60: 15, 90: 10 },
  },
  glow: {
    slug: "glow",
    name: "Glow",
    description: "Parche con colágeno y vitamina C para piel luminosa.",
    images: ["/products/glow-1.webp"],
    basePrice: { mx: 45000, br: 8900, ar: 1200000, cl: 3500000, co: 13000000 },
    isStockable: true,
    subscriptionDiscounts: { 30: 20, 60: 15, 90: 10 },
  },
  shield: {
    slug: "shield",
    name: "Shield",
    description: "Parche inmunológico con zinc, vitamina D y antioxidantes.",
    images: ["/products/shield-1.webp"],
    basePrice: { mx: 45000, br: 8900, ar: 1200000, cl: 3500000, co: 13000000 },
    isStockable: true,
    subscriptionDiscounts: { 30: 20, 60: 15, 90: 10 },
  },
  zen: {
    slug: "zen",
    name: "Zen",
    description: "Parche calmante con L-teanina y ashwagandha para manejo del estrés.",
    images: ["/products/zen-1.webp"],
    basePrice: { mx: 45000, br: 8900, ar: 1200000, cl: 3500000, co: 13000000 },
    isStockable: true,
    subscriptionDiscounts: { 30: 20, 60: 15, 90: 10 },
  },
  woman: {
    slug: "woman",
    name: "Woman",
    description: "Parche específico para el equilibrio hormonal femenino.",
    images: ["/products/woman-1.webp"],
    basePrice: { mx: 45000, br: 8900, ar: 1200000, cl: 3500000, co: 13000000 },
    isStockable: true,
    subscriptionDiscounts: { 30: 20, 60: 15, 90: 10 },
  },
};
```

- [ ] **Step 3.6: Create `packages/catalog/src/index.ts`**

```typescript
import type { Product, ProductSlug } from "./types";
import { PRODUCTS } from "./products";
import { DISPLAY_ORDER } from "./types";

export * from "./types";
export { PRODUCTS } from "./products";

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS[slug as ProductSlug];
}

export function listProducts(): Product[] {
  return DISPLAY_ORDER.map((slug) => PRODUCTS[slug]);
}
```

- [ ] **Step 3.7: Write failing test for catalog basics**

Create `packages/catalog/test/products.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { PRODUCTS, DISPLAY_ORDER, getProduct, listProducts } from "../src/index";

describe("PRODUCTS", () => {
  it("contains exactly the 6 launch SKUs", () => {
    expect(Object.keys(PRODUCTS).sort()).toEqual(
      ["energy", "glow", "shield", "sleep", "woman", "zen"],
    );
  });

  it("every product has base prices for all 5 markets", () => {
    for (const product of Object.values(PRODUCTS)) {
      expect(Object.keys(product.basePrice).sort()).toEqual(
        ["ar", "br", "cl", "co", "mx"],
      );
      for (const price of Object.values(product.basePrice)) {
        expect(Number.isInteger(price)).toBe(true);
        expect(price).toBeGreaterThan(0);
      }
    }
  });

  it("every product has subscription discounts for 30/60/90", () => {
    for (const product of Object.values(PRODUCTS)) {
      expect(product.subscriptionDiscounts).toEqual({ 30: 20, 60: 15, 90: 10 });
    }
  });
});

describe("DISPLAY_ORDER", () => {
  it("is the canonical 6-product order", () => {
    expect(DISPLAY_ORDER).toEqual([
      "energy", "sleep", "glow", "shield", "zen", "woman",
    ]);
  });
});

describe("getProduct", () => {
  it("returns product for known slug", () => {
    expect(getProduct("energy")?.name).toBe("Energy");
  });

  it("returns undefined for unknown slug", () => {
    expect(getProduct("nope")).toBeUndefined();
  });
});

describe("listProducts", () => {
  it("returns all products in DISPLAY_ORDER", () => {
    const slugs = listProducts().map((p) => p.slug);
    expect(slugs).toEqual([...DISPLAY_ORDER]);
  });
});
```

- [ ] **Step 3.8: Run — verify tests pass**

Run: `pnpm --filter @novapatch/catalog test`
Expected: PASS — all assertions.

- [ ] **Step 3.9: Write failing test for pricing helpers**

Create `packages/catalog/test/pricing.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { getPriceForMarket, getSubscriptionPrice } from "../src/pricing";
import { PRODUCTS } from "../src/products";

describe("getPriceForMarket", () => {
  it("returns base price for a given market", () => {
    expect(getPriceForMarket(PRODUCTS.energy, "mx")).toBe(45000);
  });

  it("throws for unknown market", () => {
    // @ts-expect-error — runtime test of invariant
    expect(() => getPriceForMarket(PRODUCTS.energy, "us")).toThrow(/no price/i);
  });
});

describe("getSubscriptionPrice", () => {
  it("applies 20% off for 30-day interval in MX", () => {
    // 45000 * (1 - 0.20) = 36000
    expect(getSubscriptionPrice(PRODUCTS.energy, "mx", 30)).toBe(36000);
  });

  it("applies 15% off for 60-day interval in MX", () => {
    // 45000 * 0.85 = 38250
    expect(getSubscriptionPrice(PRODUCTS.energy, "mx", 60)).toBe(38250);
  });

  it("applies 10% off for 90-day interval in MX", () => {
    // 45000 * 0.90 = 40500
    expect(getSubscriptionPrice(PRODUCTS.energy, "mx", 90)).toBe(40500);
  });

  it("rounds to integer cents (banker's rounding not required)", () => {
    const result = getSubscriptionPrice(PRODUCTS.energy, "br", 30);
    expect(Number.isInteger(result)).toBe(true);
  });
});
```

- [ ] **Step 3.10: Run — verify fail**

Run: `pnpm --filter @novapatch/catalog test`
Expected: FAIL — "Cannot find module '../src/pricing'".

- [ ] **Step 3.11: Create `packages/catalog/src/pricing.ts`**

```typescript
import type { MarketId } from "@novapatch/markets";
import type { Product, SubscriptionInterval } from "./types";

export function getPriceForMarket(product: Product, market: MarketId): number {
  const price = product.basePrice[market];
  if (price === undefined) {
    throw new Error(`no price for product ${product.slug} in market ${market}`);
  }
  return price;
}

export function getSubscriptionPrice(
  product: Product,
  market: MarketId,
  interval: SubscriptionInterval,
): number {
  const base = getPriceForMarket(product, market);
  const discountPct = product.subscriptionDiscounts[interval];
  const discounted = base * (100 - discountPct) / 100;
  return Math.round(discounted);
}
```

- [ ] **Step 3.12: Re-export pricing from `packages/catalog/src/index.ts`**

Append:

```typescript
export { getPriceForMarket, getSubscriptionPrice } from "./pricing";
```

- [ ] **Step 3.13: Run — verify all tests pass**

Run: `pnpm --filter @novapatch/catalog test`
Expected: PASS — all assertions.

- [ ] **Step 3.14: Run typecheck**

Run: `pnpm --filter @novapatch/catalog typecheck`
Expected: no output (success).

- [ ] **Step 3.15: Commit**

```bash
git add packages/catalog pnpm-lock.yaml
git commit -m "feat(catalog): 6 launch SKUs + pricing helpers with tests"
```

---

## Task 4: `apps/api` Bootstrap — Hono + /health (TDD)

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/env.ts`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/routes/health.ts`
- Create: `apps/api/test/health.test.ts`

- [ ] **Step 4.1: Create `apps/api/package.json`**

```json
{
  "name": "@novapatch/api",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "bun run --hot src/server.ts",
    "start": "bun run src/server.ts",
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "build": "echo 'bun runs TS directly, no build step'"
  },
  "dependencies": {
    "@novapatch/markets": "workspace:*",
    "@novapatch/catalog": "workspace:*",
    "hono": "^4.6.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "bun-types": "^1.1.0",
    "typescript": "^5.6.2"
  }
}
```

- [ ] **Step 4.2: Create `apps/api/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 4.3: Install deps**

Run: `pnpm install`
Expected: hono and zod installed into apps/api.

- [ ] **Step 4.4: Create `apps/api/src/env.ts`**

```typescript
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(9000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

export function readEnv(source: Record<string, string | undefined> = process.env): Env {
  return envSchema.parse(source);
}
```

- [ ] **Step 4.5: Write failing test for `/health`**

Create `apps/api/test/health.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { app } from "../src/index";

describe("GET /health", () => {
  it("returns 200 with ok status", async () => {
    const res = await app.fetch(new Request("http://localhost/health"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });

  it("sets JSON content-type", async () => {
    const res = await app.fetch(new Request("http://localhost/health"));
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });
});
```

- [ ] **Step 4.6: Run — verify fail**

Run: `pnpm --filter @novapatch/api test`
Expected: FAIL — "Cannot find module '../src/index'".

- [ ] **Step 4.7: Create `apps/api/src/routes/health.ts`**

```typescript
import { Hono } from "hono";

export const healthRoutes = new Hono();

healthRoutes.get("/health", (c) => c.json({ status: "ok" }));
```

- [ ] **Step 4.8: Create `apps/api/src/index.ts`**

```typescript
import { Hono } from "hono";
import { healthRoutes } from "./routes/health";

export const app = new Hono();

app.route("/", healthRoutes);
```

- [ ] **Step 4.9: Create `apps/api/src/server.ts`**

```typescript
import { app } from "./index";
import { readEnv } from "./env";

const env = readEnv();

const server = Bun.serve({
  port: env.PORT,
  fetch: app.fetch,
});

console.log(`api listening on http://localhost:${server.port}`);
```

- [ ] **Step 4.10: Run — verify tests pass**

Run: `pnpm --filter @novapatch/api test`
Expected: PASS — 2 assertions.

- [ ] **Step 4.11: Smoke-test the dev server**

Run in one shell: `pnpm --filter @novapatch/api dev`
In another shell: `curl -s http://localhost:9000/health`
Expected curl output: `{"status":"ok"}`
Stop the dev server with Ctrl+C.

- [ ] **Step 4.12: Run typecheck**

Run: `pnpm --filter @novapatch/api typecheck`
Expected: no output (success).

- [ ] **Step 4.13: Commit**

```bash
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): bootstrap Hono app with /health endpoint"
```

---

## Task 5: Market Middleware (TDD)

**Files:**
- Create: `apps/api/src/middleware/market.ts`
- Create: `apps/api/test/middleware/market.test.ts`

- [ ] **Step 5.1: Write failing test for market middleware**

Create `apps/api/test/middleware/market.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { Hono } from "hono";
import { marketMiddleware } from "../../src/middleware/market";

function buildApp() {
  const app = new Hono();
  app.use("*", marketMiddleware);
  app.get("/probe", (c) => c.json({ market: c.get("market") }));
  return app;
}

describe("marketMiddleware", () => {
  it("attaches market from ?market= query", async () => {
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/probe?market=mx"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.market.id).toBe("mx");
    expect(body.market.currency).toBe("MXN");
  });

  it("is case-insensitive", async () => {
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/probe?market=MX"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.market.id).toBe("mx");
  });

  it("returns 400 when ?market is missing", async () => {
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/probe"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/market/i);
  });

  it("returns 400 when ?market is unknown", async () => {
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/probe?market=us"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/market/i);
  });
});
```

- [ ] **Step 5.2: Run — verify fail**

Run: `pnpm --filter @novapatch/api test`
Expected: FAIL — "Cannot find module '../../src/middleware/market'".

- [ ] **Step 5.3: Create `apps/api/src/middleware/market.ts`**

```typescript
import type { MiddlewareHandler } from "hono";
import { isMarketId, resolveMarket, type Market } from "@novapatch/markets";

declare module "hono" {
  interface ContextVariableMap {
    market: Market;
  }
}

export const marketMiddleware: MiddlewareHandler = async (c, next) => {
  const raw = c.req.query("market");
  if (!raw) {
    return c.json({ error: "missing ?market query parameter" }, 400);
  }
  if (!isMarketId(raw)) {
    return c.json({ error: `unknown market: ${raw}` }, 400);
  }
  c.set("market", resolveMarket(raw));
  await next();
};
```

- [ ] **Step 5.4: Run — verify tests pass**

Run: `pnpm --filter @novapatch/api test`
Expected: PASS — all assertions (including previous `/health` tests).

- [ ] **Step 5.5: Commit**

```bash
git add apps/api/src/middleware apps/api/test/middleware
git commit -m "feat(api): market-resolution middleware from ?market= query"
```

---

## Task 6: `GET /catalog` and `GET /catalog/:slug` (TDD)

**Files:**
- Create: `apps/api/src/routes/catalog.ts`
- Modify: `apps/api/src/index.ts`
- Create: `apps/api/test/catalog.test.ts`

- [ ] **Step 6.1: Write failing test for `/catalog`**

Create `apps/api/test/catalog.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { app } from "../src/index";

describe("GET /catalog", () => {
  it("returns all 6 products with MX prices when market=mx", async () => {
    const res = await app.fetch(new Request("http://localhost/catalog?market=mx"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.market).toBe("mx");
    expect(body.currency).toBe("MXN");
    expect(body.products).toHaveLength(6);
    expect(body.products[0].slug).toBe("energy");
    expect(body.products[0].price).toBe(45000);
    expect(body.products[0].subscriptionPrices).toEqual({
      30: 36000,
      60: 38250,
      90: 40500,
    });
  });

  it("returns products in canonical display order", async () => {
    const res = await app.fetch(new Request("http://localhost/catalog?market=mx"));
    const body = await res.json();
    const slugs = body.products.map((p: { slug: string }) => p.slug);
    expect(slugs).toEqual(["energy", "sleep", "glow", "shield", "zen", "woman"]);
  });

  it("returns 400 for unknown market", async () => {
    const res = await app.fetch(new Request("http://localhost/catalog?market=us"));
    expect(res.status).toBe(400);
  });
});

describe("GET /catalog/:slug", () => {
  it("returns single product with prices resolved for the market", async () => {
    const res = await app.fetch(new Request("http://localhost/catalog/energy?market=mx"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBe("energy");
    expect(body.name).toBe("Energy");
    expect(body.price).toBe(45000);
    expect(body.currency).toBe("MXN");
  });

  it("returns 404 for unknown slug", async () => {
    const res = await app.fetch(new Request("http://localhost/catalog/unknown?market=mx"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 400 for missing market", async () => {
    const res = await app.fetch(new Request("http://localhost/catalog/energy"));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 6.2: Run — verify fail**

Run: `pnpm --filter @novapatch/api test`
Expected: FAIL — `/catalog` returns 404 (route not registered).

- [ ] **Step 6.3: Create `apps/api/src/routes/catalog.ts`**

```typescript
import { Hono } from "hono";
import {
  getProduct,
  listProducts,
  getPriceForMarket,
  getSubscriptionPrice,
  type Product,
  type SubscriptionInterval,
} from "@novapatch/catalog";
import type { Market } from "@novapatch/markets";
import { marketMiddleware } from "../middleware/market";

export const catalogRoutes = new Hono();

catalogRoutes.use("*", marketMiddleware);

const SUBSCRIPTION_INTERVALS: SubscriptionInterval[] = [30, 60, 90];

function serializeProduct(product: Product, market: Market) {
  const subscriptionPrices = Object.fromEntries(
    SUBSCRIPTION_INTERVALS.map((interval) => [
      interval,
      getSubscriptionPrice(product, market.id, interval),
    ]),
  );
  return {
    slug: product.slug,
    name: product.name,
    description: product.description,
    images: product.images,
    price: getPriceForMarket(product, market.id),
    currency: market.currency,
    subscriptionPrices,
  };
}

catalogRoutes.get("/catalog", (c) => {
  const market = c.get("market");
  return c.json({
    market: market.id,
    currency: market.currency,
    products: listProducts().map((p) => serializeProduct(p, market)),
  });
});

catalogRoutes.get("/catalog/:slug", (c) => {
  const market = c.get("market");
  const slug = c.req.param("slug");
  const product = getProduct(slug);
  if (!product) {
    return c.json({ error: `product not found: ${slug}` }, 404);
  }
  return c.json(serializeProduct(product, market));
});
```

- [ ] **Step 6.4: Modify `apps/api/src/index.ts` to mount catalog routes**

Replace file with:

```typescript
import { Hono } from "hono";
import { healthRoutes } from "./routes/health";
import { catalogRoutes } from "./routes/catalog";

export const app = new Hono();

app.route("/", healthRoutes);
app.route("/", catalogRoutes);
```

- [ ] **Step 6.5: Run — verify tests pass**

Run: `pnpm --filter @novapatch/api test`
Expected: PASS — all `/catalog` and `/catalog/:slug` tests green, plus health + middleware tests.

- [ ] **Step 6.6: Smoke-test via curl**

Start dev: `pnpm --filter @novapatch/api dev`
In another shell:

```bash
curl -s 'http://localhost:9000/catalog?market=mx' | head -c 300
curl -s 'http://localhost:9000/catalog/energy?market=mx'
```

Expected: valid JSON, 6 products in first call, single product with `"price": 45000` in second. Stop the dev server.

- [ ] **Step 6.7: Run typecheck**

Run: `pnpm --filter @novapatch/api typecheck`
Expected: no output.

- [ ] **Step 6.8: Commit**

```bash
git add apps/api
git commit -m "feat(api): GET /catalog and GET /catalog/:slug with market pricing"
```

---

## Task 7: Root Workspace Scripts + Full Green Build

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 7.1: Verify full workspace test run**

Run: `pnpm test`
Expected: all three packages (`markets`, `catalog`, `api`) report PASS. Zero failures.

- [ ] **Step 7.2: Verify full workspace typecheck**

Run: `pnpm typecheck`
Expected: no output from any package (success).

- [ ] **Step 7.3: Document the dev loop in README**

Append to `README.md`:

```markdown

## Running the API

    pnpm install
    pnpm --filter @novapatch/api dev

The server listens on `http://localhost:9000`. Try:

    curl 'http://localhost:9000/health'
    curl 'http://localhost:9000/catalog?market=mx'
    curl 'http://localhost:9000/catalog/energy?market=mx'

## Testing

Run every package's tests:

    pnpm test

Run a single package:

    pnpm --filter @novapatch/catalog test
```

- [ ] **Step 7.4: Commit**

```bash
git add README.md
git commit -m "docs: document dev loop and smoke-test commands"
```

---

## Exit Criteria for This Plan

- `pnpm test` passes across `@novapatch/markets`, `@novapatch/catalog`, and `@novapatch/api`.
- `pnpm typecheck` is clean.
- `pnpm --filter @novapatch/api dev` boots and responds on `/health`, `/catalog?market=mx`, and `/catalog/energy?market=mx`.
- Commits exist for each task above (7 focused commits total).

## Next Plans (not part of this one)

1. **Drizzle + Postgres schema + migrations** — all 7 tables from the spec wired up with tests.
2. **Clerk JWT middleware + `/me/*` protected route skeleton** — auth boundary with test fixtures.
3. **Pricing engine + `POST /discounts/validate`** — full-total calculation with promo + influencer codes.
4. **`POST /checkout`** — one-time purchase, then subscription variant.
5. **`/me/subscriptions/*` self-service** — pause/resume/cancel/frequency.
6. **Background jobs** — daily billing + upcoming-charge reminders with `Bun.cron()`.
7. **Webhooks** — Openpay, MercadoPago, Envia signature verification + handlers.
8. **Admin endpoints + Next.js admin pages**.
9. **Frontend consolidation** — bring `novafrontend` into `apps/web` and point it at the new API.
