# Tienda + Cart + Checkout — Design Spec

**Status:** Approved — ready for implementation plan.
**Scope:** Customer-facing buying flow end-to-end: product grid at `/[locale]/tienda`, client-side cart (Zustand + localStorage), cart drawer in Navbar, dedicated `/[locale]/checkout` page calling backend. Adds a public `POST /checkout` endpoint for guest one-time purchases.

---

## Goals

1. A user can browse products at `/mx/tienda` and add them as either one-time or subscription purchases.
2. The cart persists across reloads (localStorage) and is accessible from a Sheet drawer in the Navbar.
3. A logged-in user can complete checkout (one-time or subscription) hitting `POST /me/checkout`.
4. A guest user can complete a one-time-only checkout hitting a new public `POST /checkout`.
5. Subscription purchases require auth (no guest subscriptions).
6. Discount codes are only available to logged-in users.

## Non-Goals

- Product detail page (PDP) — single-page tienda only.
- Quantity selector inside `<ProductCard>` (only in drawer).
- Real payment gateway integration — `paymentToken` is a fixed stub (`tok_test_visa`).
- Address autocomplete / validation (Google Maps, COPOMEX).
- Cross-device cart sync.
- Guest → logged-in cart merge / customer merge.
- Cookie consent banner / SEO sitemap.
- ISR/revalidate for the catalog (catalog is statically defined in `@novapatch/catalog`).
- Real product images (placeholder/grey fallback for v1).
- Discount codes for guest checkout.
- Empty-state illustration when catalog returns 0 products.

---

## Frontend — `/[locale]/tienda`

### Page (`app/[locale]/tienda/page.tsx`, Server Component)

- Resolves locale → market.
- `fetchCatalog({ market, apiUrl })` server-side with `cache: "force-cache"` (catalog is static; no per-user data).
- Sorts products by canonical order: `["energy","sleep","glow","shield","zen","woman"]`.
- Renders `<ProductGrid products currency>`.

### `<ProductGrid>` (Server)

- Responsive grid: 1 col mobile / 2 col tablet (md) / 3 col desktop (lg).
- Maps to `<ProductCard>`.

### `<ProductCard product currency>` (Client)

- **Image area:** `product.images[0]` if available, else neutral grey placeholder (rounded-2xl, aspect-square).
- **Name + short description** (2-line clamp).
- **Mode toggle** (shadcn `Tabs` or `RadioGroup` styled as pill toggle): "Compra única" / "Suscripción". Default: "Compra única".
- **If "Compra única":**
  - Price: `formatMoney(product.price, currency, locale)`.
- **If "Suscripción":**
  - `<Select>` with three options. Labels: `"Cada mes (-20%)"`, `"Cada 2 meses (-15%)"`, `"Cada 3 meses (-10%)"`. Values: 30 / 60 / 90. Default: 30.
  - Price: `formatMoney(product.subscriptionPrices[interval], currency, locale)`.
- **Quantity:** fixed at 1 in the card. Adjustable in the drawer.
- **"Agregar" button:** primary variant, full-width.
  - On click: `useCart().addItem({ slug, quantity: 1, subscription?, snapshot: { name, unitPrice, currency, image } })` + sonner toast `t("toast.added", { name })`. Does NOT auto-open the drawer.

### `<CartIcon>` (Client, mounted in Navbar)

- `ShoppingBag` icon (lucide) with count badge (`useCart().itemCount()`). Hidden until store hydrated to avoid SSR mismatch.
- Click → `useCart().setOpen(true)`.

### `<CartDrawer>` (Client, mounted once in `[locale]/layout.tsx`)

shadcn `Sheet` (right side). Always rendered; visibility controlled by `useCart().isOpen`.

- **Empty:** "Tu carrito está vacío" + link to `/tienda`.
- **With items:** vertical list, one row per `(slug, interval?)` composite key:
  - Thumbnail (snapshot `image` or placeholder).
  - Name + chip "Suscripción cada N días" if `subscription`.
  - `formatMoney(unitPrice * quantity)`.
  - `<QuantityStepper>` (− qty +) calling `updateQuantity`.
  - Trash icon → `removeItem`.
- **Footer (sticky):**
  - Subtotal: `formatMoney(sum, currency, locale)`.
  - Caption muted: "Envío e impuestos se calculan en el checkout".
  - Primary button:
    - Default: "Ir a checkout" → navigate to `/[locale]/checkout`, close drawer.
    - If `hasSubscription() && !isSignedIn`: "Iniciar sesión para suscribirte" → navigate to `/sign-in?redirect_url=/mx/checkout`.

### Cart store (`lib/cart-store.ts`)

```ts
type CartItem = {
  slug: ProductSlug;
  quantity: number;
  subscription?: { interval: 30 | 60 | 90 };
  snapshot: {
    name: string;
    unitPrice: number;   // cents, snapshotted at addItem time
    currency: string;
    image?: string;
  };
};

type CartStore = {
  items: CartItem[];
  isOpen: boolean;

  addItem: (item: CartItem) => void;       // merge by composite key
  updateQuantity: (key: string, qty: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  setOpen: (open: boolean) => void;

  hasSubscription: () => boolean;
  itemCount: () => number;
  subtotal: () => number;
};

export const useCart = create<CartStore>()(
  persist(/* impl */, { name: "novapatch-cart", version: 1 })
);
```

- Composite key: `${slug}:${subscription?.interval ?? "once"}`.
- `addItem` merges quantity if key exists; otherwise pushes new item.
- `unitPrice` snapshot is for **display only** — the backend re-prices in `calculateQuote` at checkout. If the snapshot drifts from current catalog price, the backend total is authoritative.

**Hydration:** Zustand `persist` reads localStorage on client mount → SSR/CSR mismatch on first render. Use `useHasHydrated()` guard for any UI that depends on cart state (badge, drawer contents). Show neutral fallback (e.g., no badge, empty drawer body) until hydrated.

---

## Frontend — `/[locale]/checkout`

### Page (`app/[locale]/checkout/page.tsx`, Client Component)

Uses `useCart`, `useAuth` (Clerk), `useState` for form, `useRouter`.

**Auth/cart gates (run on mount, before render):**
1. If `cart.items.length === 0` → redirect to `/[locale]/tienda`.
2. If `cart.hasSubscription() && !isSignedIn` → redirect to `/sign-in?redirect_url=/mx/checkout`.

**Layout:**

```
Card (max-w-3xl, brand-cream bg)
├── h1: "Checkout"
├── [if !isSignedIn] section: "¿Tenés cuenta? Iniciar sesión" link
├── [if !isSignedIn] field: email (required for guest)
├── section "Dirección de envío":
│     line1, line2, city, state, postalCode (country fixed = "MX" for now)
├── section "Pago":
│     hidden paymentToken = "tok_test_visa"
│     caption muted: "Modo de prueba — sin gateway real"
├── [if isSignedIn] section "Código de descuento":
│     input + "Aplicar" button (sets local state; sent on submit)
├── section "Resumen":
│     read-only items list + subtotal
│     caption: "Impuestos y envío se calculan al confirmar"
└── primary button "Pagar"
```

**Submit handler (logged-in path):**
1. Zod-validate form (mirrors backend `ShippingAddressSchema`).
2. Build payload `{ market, items, shippingAddress, paymentToken, discountCode? }`.
3. `submitCheckout({ token: await getToken(), ... , idempotencyKey })`.
4. On success: `cart.clear()`, sonner toast, `router.push("/[locale]/cuenta/pedidos")`.
5. On error: toast with i18n message keyed by `ApiError.code`; form remains editable.

**Submit handler (guest path):**
1. Zod-validate form (includes `email`).
2. `submitGuestCheckout({ email, market, items, shippingAddress, paymentToken, idempotencyKey })`.
3. On success: `cart.clear()`, sonner toast, `router.push("/[locale]/checkout/gracias?orderId={id}")`.
4. On error: same as logged-in.

**Idempotency-Key:**
- Generate `crypto.randomUUID()` once on mount, persist in `sessionStorage` under key `checkout-idempotency-key`. Clear on success.
- Re-submitting the same form (e.g., user retry after network error) reuses the key → backend returns the existing order on replay.

**Guest "gracias" page (`app/[locale]/checkout/gracias/page.tsx`, Server):**
- Reads `orderId` from query string.
- For v1: simple "¡Gracias por tu compra! Te enviamos un correo a {email}." No order detail fetch (would require new public endpoint or token). Out-of-scope for v1.

### API client additions (`lib/api-client.ts`)

```ts
export async function submitCheckout(args: {
  apiUrl: string;
  token: string;
  idempotencyKey: string;
  body: {
    market: string;
    items: CartItem[];
    shippingAddress: ShippingAddress;
    paymentToken: string;
    discountCode?: string;
  };
}): Promise<CheckoutSuccess>;

export async function submitGuestCheckout(args: {
  apiUrl: string;
  idempotencyKey: string;
  body: {
    market: string;
    email: string;
    items: CartItem[];
    shippingAddress: ShippingAddress;
    paymentToken: string;
  };
}): Promise<CheckoutSuccess>;
```

Both throw `ApiError` on non-2xx.

### Catalog fetcher (`lib/api.ts`)

Add `fetchCatalog({ market, apiUrl })` (Server-only fetcher). Cache `force-cache`.

---

## Backend changes

### 1. Refactor: `services/process-checkout.ts`

Extract the core checkout pipeline (currently in `routes/checkout.ts`) into a shared service. Both `/me/checkout` and `/checkout` become thin handlers around it.

```ts
type ProcessCheckoutInput = {
  customer: { id: string; email: string };
  market: MarketId;
  items: CartItemInput[];
  shippingAddress: ShippingAddress;
  paymentToken: string;
  deviceSessionId?: string;
  recurringConsent?: boolean;
  discountCode?: string;
  idempotencyKey?: string;
  allowSubscriptions: boolean;
};

type ProcessCheckoutResult =
  | { ok: true; status: 200 | 201; order: OrderWithRelations; quote: PricingQuote }
  | { ok: false; code: ApiErrorCode; message: string; status: ApiErrorStatus };

async function processCheckout(deps, input): Promise<ProcessCheckoutResult>;
```

The `allowSubscriptions: false` path returns `{ ok: false, code: "subscription_not_allowed_guest", status: 422 }` if any item has `subscription`. Discount code handling already short-circuits on missing — guest passes `discountCode: undefined`.

`/me/checkout` route stays functionally identical (regression covered by existing tests).

### 2. New route: `POST /checkout` (`routes/checkout-public.ts`)

- **No auth.** No Clerk middleware.
- Body schema: same as `/me/checkout` minus `discountCode`, plus `email: z.string().email()`.
- Resolves customer via `upsertCustomerByEmail({ email, market })` (new repo function).
- Calls `processCheckout({ ..., allowSubscriptions: false, customer: { id, email } })`.
- Maps result to HTTP response same way `/me/checkout` does.
- CORS: `Idempotency-Key` already in global `allowHeaders` — no change.

### 3. Repo addition: `upsertCustomerByEmail`

```ts
// repos/customers.ts
export async function upsertCustomerByEmail(
  db: Db,
  args: { email: string; market: MarketId },
): Promise<{ id: string; email: string }>;
```

- Looks up customer with `email = $1 AND clerk_user_id IS NULL`.
- If found, returns it. If not, inserts a new row with `email, market, clerk_user_id = NULL`.
- **Important:** does NOT match against customers with `clerk_user_id IS NOT NULL` (those are linked Clerk accounts; we don't want to attach a guest order to someone else's authenticated customer record). A guest who later logs in and registers under the same email will have two customer rows; merging is out-of-scope.

### 4. New error code

Add to `lib/errors.ts`:

```ts
type ApiErrorCode =
  | ...existing...
  | "subscription_not_allowed_guest";
```

Status `422`. Message: `"Subscriptions require an authenticated customer. Please sign in or register."`.

### 5. Schema

No migrations. `customers` table already has nullable `clerk_user_id`, `email`, `market`. `orders.idempotency_key` already global-unique (partial), shared across both endpoints — fine.

### 6. CORS

Already covered by existing `allowHeaders: ["Authorization", "Content-Type", "Idempotency-Key"]`.

---

## Testing

### Backend

- **`routes/checkout-public.test.ts`** (new):
  - 200/201 happy path: guest with one-time items → order persisted, `customer_id` populated, `idempotency_key` stored.
  - 422 when any item has `subscription` (code `subscription_not_allowed_guest`).
  - 400 invalid email.
  - Idempotency: two requests with same `Idempotency-Key` return the same order; second is `200` (replay) with reconstructed quote.
  - Customer reuse: two checkouts with same `email` reuse the same customer row (no duplicate customer).
  - Customer guard: a checkout with email that matches a Clerk-linked customer creates a NEW guest customer row, not attach to the linked one.
  - `Authorization` header is ignored (endpoint is public — no JWT validation).
- **`routes/checkout.test.ts`** (existing): all tests still green after refactor.
- **`services/process-checkout.test.ts`** (optional): only if branching logic for `allowSubscriptions` is non-trivial after refactor.

### Frontend

No unit tests in v1. Manual smoke flow:
1. `/mx/tienda` → add one-time product → drawer shows it → checkout as guest → order shows up in DB.
2. Add subscription product → drawer shows "Iniciar sesión" CTA → sign in → complete checkout → order shows in `/cuenta/pedidos`.
3. Mixed cart with subscription + guest path: confirm redirect to sign-in.

Playwright is out-of-scope.

---

## Behavior notes & edge cases

- **Cart price drift:** if catalog price changes between `addItem` and checkout, the snapshot in localStorage is stale. The backend `calculateQuote` always recomputes from current catalog. UI shows the snapshot subtotal in the drawer; the checkout page can re-fetch catalog to show fresh prices, but for v1 we render snapshots and rely on the backend total in the response to be authoritative. Acceptable for v1 since prices are static.
- **Hydration mismatch:** badge count and drawer contents render only after `useHasHydrated()` returns true. This causes a brief flash of "0" or "no items" on initial load — acceptable.
- **Idempotency-Key reuse:** if the user changes the cart, the old key is stale but harmless — the backend matches on key, returns the original order. To avoid confusion, generate a new key when the cart contents change (debounced). Implementation detail for plan.
- **Subscription detection in cart:** `hasSubscription()` returns true if any item has `subscription` defined. Drives both the drawer CTA and checkout auth gate.
- **Discount code field:** rendered conditionally on `isSignedIn`. If a guest signs up mid-checkout flow, the cart persists; on returning to `/checkout` the field appears.
- **i18n:** all strings under `pages.tienda` and `pages.checkout` namespaces in `apps/web/messages/es.json`. Error messages keyed by `ApiError.code`.

---

## Out-of-Scope Follow-ups

- Product detail page (`/tienda/[slug]`).
- Quantity selector in card.
- Real payment gateway (Openpay/MercadoPago/Stripe) integration.
- Address validation / autocomplete.
- Cross-device cart sync (server-side cart endpoint).
- Guest → registered customer merge on signup.
- Cart merge between logged-out and logged-in sessions.
- Catalog ISR / cache invalidation on price changes.
- Order detail page for guests (currently just `gracias` page with email).
- Email confirmation via Resend (separate plan).
- Discount codes for guest checkout (with email-based throttling).
- Cookie consent banner.
- Real product images.
- Mixed-cart UX improvements (e.g., split items into separate orders).
