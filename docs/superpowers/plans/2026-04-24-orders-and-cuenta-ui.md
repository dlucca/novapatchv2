# Orders Endpoint + `/cuenta` UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `GET /me/orders` on the API and build the customer area `/[locale]/cuenta/*` (Perfil / Suscripciones / Pedidos) so a logged-in customer can see their orders and manage their subscriptions (pause / resume / cancel / change frequency) from the browser.

**Architecture:** Backend adds one endpoint that reuses the existing `orders` schema with items embedded. Frontend splits by route under `/cuenta/*` — each page is a Server Component that fetches with `auth().getToken()` server-side and streams the result to a Client Component for interactivity. Mutations round-trip via a small client-side API module, then `router.refresh()` re-fetches server state (no optimistic updates).

**Tech Stack:** Bun + Hono + Drizzle (postgres.js) on the backend. Next.js 15 + React 19 + Tailwind v4 + shadcn/ui + next-intl + Clerk on the frontend. Tests: `bun:test` (backend integration against real Postgres via `useTestDb()`). No unit UI tests in v1 per spec.

**Spec:** [docs/superpowers/specs/2026-04-24-orders-and-cuenta-ui-design.md](../specs/2026-04-24-orders-and-cuenta-ui-design.md). Read before implementing.

---

## Context cheatsheet (read before Task 1)

- **Existing backend routes under `/me/*`:** `GET /me/customer`, `POST /me/checkout`, `GET /me/subscriptions`, `POST /me/subscriptions/:id/{pause,resume,cancel,frequency}`. Mount lives in `apps/api/src/routes/me.ts` via `createMeRoutes(deps)`.
- **Existing repo `apps/api/src/repos/orders.ts`:** has `persistOrder` + `findOrderByIdempotencyKey`. We add `listOrdersWithItemsByCustomerId`.
- **Existing web page `/cuenta/page.tsx`:** renders Perfil (customer email + createdAt). We'll move this logic under the new `/cuenta/layout.tsx` but keep the `page.tsx` at the same path.
- **Shadcn components:** only `button` + `card` exist in `apps/web/src/components/ui/`. We add `badge`, `dialog`, `alert-dialog`, `select`, `skeleton`, `sonner`.
- **i18n:** `apps/web/messages/es.json` is the single locale file for `mx`. All copy goes under `cuenta.*`.
- **Error envelope:** `{error: {code, message, details?}}` — already handled by the web `ApiError` class in `apps/web/src/lib/api.ts`.
- **Token auth in Client Components:** `import { useAuth } from "@clerk/nextjs"` then `const token = await auth.getToken()`. Clerk auto-refreshes.
- **`NEXT_PUBLIC_API_URL`:** env var read from `process.env.NEXT_PUBLIC_API_URL`. Server Components read it directly. Client Components receive it as a prop from the Server Component parent (do NOT read `process.env.*_PUBLIC_*` inside a Client Component — Next.js injects it at build but passing as prop is cleaner).
- **`router.refresh()`:** from `next/navigation`. Forces the Server Component parent to re-fetch and re-render.
- **Toasts:** `sonner` via `import { toast } from "sonner"`. Requires `<Toaster />` mounted once in the root layout.

---

## File Structure

**New (backend):**
- `apps/api/test/routes/orders.test.ts`

**Modify (backend):**
- `apps/api/src/repos/orders.ts` — add `listOrdersWithItemsByCustomerId`
- `apps/api/src/routes/me.ts` — mount `/orders` sub-route
- `apps/api/src/routes/orders.ts` — **new** factory `createOrdersRoutes({db, userClient})`

**New (frontend):**
- `apps/web/src/components/ui/badge.tsx` (shadcn)
- `apps/web/src/components/ui/dialog.tsx` (shadcn)
- `apps/web/src/components/ui/alert-dialog.tsx` (shadcn)
- `apps/web/src/components/ui/select.tsx` (shadcn)
- `apps/web/src/components/ui/skeleton.tsx` (shadcn)
- `apps/web/src/components/ui/sonner.tsx` (shadcn)
- `apps/web/src/lib/money.ts`
- `apps/web/src/lib/dates.ts`
- `apps/web/src/lib/api-client.ts` — client-side mutations
- `apps/web/src/components/cuenta/cuenta-nav.tsx` — tab nav (Client)
- `apps/web/src/components/cuenta/status-badge.tsx`
- `apps/web/src/components/cuenta/orders-list.tsx` — Server-renderable
- `apps/web/src/components/cuenta/subscriptions-list.tsx` — Client
- `apps/web/src/components/cuenta/subscription-card.tsx` — Client (the action host)
- `apps/web/src/app/[locale]/cuenta/layout.tsx`
- `apps/web/src/app/[locale]/cuenta/suscripciones/page.tsx`
- `apps/web/src/app/[locale]/cuenta/suscripciones/loading.tsx`
- `apps/web/src/app/[locale]/cuenta/suscripciones/error.tsx`
- `apps/web/src/app/[locale]/cuenta/pedidos/page.tsx`
- `apps/web/src/app/[locale]/cuenta/pedidos/loading.tsx`
- `apps/web/src/app/[locale]/cuenta/pedidos/error.tsx`

**Modify (frontend):**
- `apps/web/src/lib/api.ts` — add `fetchSubscriptions` + `fetchOrders`
- `apps/web/messages/es.json` — add `cuenta.*` keys
- `apps/web/src/app/[locale]/layout.tsx` — mount `<Toaster />` for sonner
- `apps/web/src/app/[locale]/cuenta/page.tsx` — unchanged logic, but now rendered inside the new `cuenta/layout.tsx` shell (remove the outer `<main>`/`<Card>` wrapper — the layout owns them)

---

## Task 1: Backend — `GET /me/orders`

**Files:**
- Modify: `apps/api/src/repos/orders.ts` — add `listOrdersWithItemsByCustomerId`
- Create: `apps/api/src/routes/orders.ts` — `createOrdersRoutes({db, userClient})`
- Modify: `apps/api/src/routes/me.ts` — mount the new sub-route
- Create: `apps/api/test/routes/orders.test.ts`

- [ ] **Step 1: Add the repo helper**

Append to `apps/api/src/repos/orders.ts` (after the existing exports, keep `persistOrder` + `findOrderByIdempotencyKey` unchanged):

```typescript
export interface OrderWithItems {
  order: Order;
  items: OrderItem[];
}

/**
 * Lists a customer's orders with their items embedded, sorted by createdAt DESC.
 * Two queries (one for orders, one for items), fanned out in-memory. For v1
 * volumes this is fine; a JOIN would add complexity without a measurable win.
 */
export async function listOrdersWithItemsByCustomerId(
  db: Db,
  customerId: string,
): Promise<OrderWithItems[]> {
  const orderRows = await db
    .select()
    .from(orders)
    .where(eq(orders.customerId, customerId))
    .orderBy(desc(orders.createdAt));
  if (orderRows.length === 0) return [];

  const ids = orderRows.map((o) => o.id);
  const items = await db
    .select()
    .from(orderItems)
    .where(inArray(orderItems.orderId, ids));
  const byOrderId = new Map<string, OrderItem[]>();
  for (const it of items) {
    const bucket = byOrderId.get(it.orderId) ?? [];
    bucket.push(it);
    byOrderId.set(it.orderId, bucket);
  }
  return orderRows.map((o) => ({ order: o, items: byOrderId.get(o.id) ?? [] }));
}
```

Imports at the top of the file need to add `desc` and `inArray`. The existing import line is:

```typescript
import { eq, sql } from "drizzle-orm";
```

Replace it with:

```typescript
import { desc, eq, inArray, sql } from "drizzle-orm";
```

- [ ] **Step 2: Write failing route tests**

`apps/api/test/routes/orders.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { createApp } from "../../src/index";
import { createStubVerifier, createStubUserClient } from "../../src/lib/clerk";
import { useTestDb } from "../helpers/db";
import { persistOrder } from "../../src/repos/orders";

const SHIPPING = {
  line1: "Av. X 1",
  city: "CDMX",
  state: "CDMX",
  postalCode: "00000",
  country: "MX",
};

function buildApp(getDb: ReturnType<typeof useTestDb>["getDb"]) {
  const verifier = createStubVerifier({
    tok_alice: { clerkUserId: "user_alice" },
    tok_bob: { clerkUserId: "user_bob" },
  });
  const userClient = createStubUserClient({
    user_alice: { clerkUserId: "user_alice", email: "alice@example.com" },
    user_bob: { clerkUserId: "user_bob", email: "bob@example.com" },
  });
  return createApp({ verifier, userClient, db: getDb() });
}

async function ensureCustomer(
  app: ReturnType<typeof createApp>,
  bearer: string,
): Promise<string> {
  const res = await app.fetch(
    new Request("http://localhost/me/customer", {
      headers: { Authorization: bearer },
    }),
  );
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function seedOrder(
  db: ReturnType<typeof useTestDb>["getDb"] extends () => infer T ? T : never,
  customerId: string,
  productSlug: "energy" | "sleep",
  extraOrderFields: Record<string, unknown> = {},
) {
  const res = await persistOrder(db, {
    order: {
      customerId,
      market: "mx",
      currency: "MXN",
      subtotal: 45000,
      tax: 7200,
      shipping: 8500,
      discountAmount: 0,
      total: 60700,
      status: "paid",
      paymentProvider: "stub",
      paymentChargeId: `stub_${crypto.randomUUID()}`,
      shippingAddress: SHIPPING,
      idempotencyKey: `seed_${crypto.randomUUID()}`,
      ...extraOrderFields,
    },
    orderItems: [
      {
        productSlug,
        name: productSlug,
        unitPrice: 45000,
        quantity: 1,
        isSubscription: false,
      },
    ],
    subscriptions: [],
  });
  return res.orderId;
}

describe("GET /me/orders", () => {
  const { getDb } = useTestDb();

  it("401 without Authorization", async () => {
    const app = buildApp(getDb);
    const res = await app.fetch(new Request("http://localhost/me/orders"));
    expect(res.status).toBe(401);
  });

  it("returns empty array when the customer has no orders", async () => {
    const app = buildApp(getDb);
    await ensureCustomer(app, "Bearer tok_alice");
    const res = await app.fetch(
      new Request("http://localhost/me/orders", {
        headers: { Authorization: "Bearer tok_alice" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { orders: unknown[] };
    expect(body.orders).toEqual([]);
  });

  it("returns orders sorted by createdAt DESC with items embedded", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const first = await seedOrder(db, aliceId, "energy");
    await Bun.sleep(10);
    const second = await seedOrder(db, aliceId, "sleep");

    const res = await app.fetch(
      new Request("http://localhost/me/orders", {
        headers: { Authorization: "Bearer tok_alice" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      orders: Array<{
        id: string;
        total: number;
        items: Array<{ productSlug: string; quantity: number }>;
      }>;
    };
    expect(body.orders).toHaveLength(2);
    expect(body.orders[0]?.id).toBe(second);
    expect(body.orders[1]?.id).toBe(first);
    expect(body.orders[0]?.items).toHaveLength(1);
    expect(body.orders[0]?.items[0]?.productSlug).toBe("sleep");
  });

  it("returns only the caller's orders (cross-customer isolation)", async () => {
    const db = getDb();
    const app = buildApp(getDb);
    const aliceId = await ensureCustomer(app, "Bearer tok_alice");
    const bobId = await ensureCustomer(app, "Bearer tok_bob");
    await seedOrder(db, aliceId, "energy");
    await seedOrder(db, bobId, "sleep");

    const res = await app.fetch(
      new Request("http://localhost/me/orders", {
        headers: { Authorization: "Bearer tok_alice" },
      }),
    );
    const body = (await res.json()) as {
      orders: Array<{ items: Array<{ productSlug: string }> }>;
    };
    expect(body.orders).toHaveLength(1);
    expect(body.orders[0]?.items[0]?.productSlug).toBe("energy");
  });
});
```

- [ ] **Step 3: Run — expect 404 / module-not-found**

```bash
cd apps/api && bun test test/routes/orders.test.ts
```

Expected: FAIL. The route isn't mounted yet, so the 401 test will see 404; the others will see module-not-found or 404.

- [ ] **Step 4: Implement the route factory**

`apps/api/src/routes/orders.ts`:

```typescript
import { Hono } from "hono";
import type { Db } from "../db";
import type { ClerkUserClient } from "../lib/clerk";
import { upsertCustomerByClerkUserId } from "../repos/customers";
import {
  listOrdersWithItemsByCustomerId,
  type OrderWithItems,
} from "../repos/orders";
import type { Order, OrderItem } from "../db/schema/orders";

export interface OrdersRoutesDeps {
  db: Db;
  userClient: ClerkUserClient;
}

function serializeItem(i: OrderItem) {
  return {
    productSlug: i.productSlug,
    name: i.name,
    unitPrice: i.unitPrice,
    quantity: i.quantity,
    isSubscription: i.isSubscription,
    intervalDays: i.intervalDays,
  };
}

function serializeOrder(o: Order, items: OrderItem[]) {
  return {
    id: o.id,
    createdAt: o.createdAt.toISOString(),
    status: o.status,
    market: o.market,
    currency: o.currency,
    subtotal: o.subtotal,
    discountAmount: o.discountAmount,
    tax: o.tax,
    shipping: o.shipping,
    total: o.total,
    paymentChargeId: o.paymentChargeId,
    items: items.map(serializeItem),
  };
}

export function createOrdersRoutes(deps: OrdersRoutesDeps): Hono {
  const r = new Hono();

  r.get("/", async (c) => {
    const clerkUserId = c.get("clerkUserId");
    const { email } = await deps.userClient.getUser(clerkUserId);
    const customer = await upsertCustomerByClerkUserId(deps.db, {
      clerkUserId,
      email,
    });
    const rows: OrderWithItems[] = await listOrdersWithItemsByCustomerId(
      deps.db,
      customer.id,
    );
    return c.json({
      orders: rows.map((r) => serializeOrder(r.order, r.items)),
    });
  });

  return r;
}
```

- [ ] **Step 5: Mount the route in `createMeRoutes`**

Edit `apps/api/src/routes/me.ts`. Add the import at the top:

```typescript
import { createOrdersRoutes } from "./orders";
```

Inside `createMeRoutes`, after the existing `/subscriptions` mount and before `if (deps.gateway) { ... }`:

```typescript
  me.route(
    "/orders",
    createOrdersRoutes({ db: deps.db, userClient: deps.userClient }),
  );
```

- [ ] **Step 6: Run the tests + full suite**

```bash
cd apps/api && bun test test/routes/orders.test.ts
cd apps/api && bun test && bun run typecheck
```

Expected: 4 new pass; no regressions; typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/repos/orders.ts apps/api/src/routes/orders.ts apps/api/src/routes/me.ts apps/api/test/routes/orders.test.ts
git commit -m "feat(api): GET /me/orders with items embedded"
```

---

## Task 2: Frontend foundation — shadcn, utilities, i18n

**Files:**
- Install (via `npx shadcn`): `badge`, `dialog`, `alert-dialog`, `select`, `skeleton`, `sonner`
- Create: `apps/web/src/lib/money.ts`
- Create: `apps/web/src/lib/dates.ts`
- Create: `apps/web/src/lib/api-client.ts`
- Modify: `apps/web/src/lib/api.ts` — add `fetchSubscriptions` + `fetchOrders`
- Modify: `apps/web/messages/es.json` — add `cuenta.*` keys
- Modify: `apps/web/src/app/[locale]/layout.tsx` — mount `<Toaster />`

- [ ] **Step 1: Install shadcn components**

From repo root:

```bash
cd apps/web && npx shadcn@latest add badge dialog alert-dialog select skeleton sonner
```

If prompted about overwrite or config, accept defaults. Expected: 6 new files in `apps/web/src/components/ui/`.

**If the install fails** (e.g., network), report BLOCKED — do not hand-write shadcn components. The style tokens and accessibility wiring are non-trivial.

- [ ] **Step 2: Add money helper**

`apps/web/src/lib/money.ts`:

```typescript
/**
 * Formats integer cents as a localized currency string.
 *
 * Example:
 *   formatMoney(45000, "MXN", "es-MX") → "$450.00"
 */
export function formatMoney(
  cents: number,
  currency: string,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}
```

- [ ] **Step 3: Add date helpers**

`apps/web/src/lib/dates.ts`:

```typescript
/**
 * Formats a `YYYY-MM-DD` string or ISO timestamp as a localized date.
 */
export function formatDate(value: string, locale: string): string {
  // A date-only "YYYY-MM-DD" parses in UTC; use `T00:00:00Z` to avoid TZ drift.
  const iso = value.length === 10 ? `${value}T00:00:00Z` : value;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}

/**
 * Mirrors the backend's `today + days` UTC arithmetic. Used by the frequency
 * dialog to show the customer what the new nextBillingDate will be before
 * they confirm the change.
 *
 * Returns a "YYYY-MM-DD" string.
 */
export function addDaysUtc(base: Date, days: number): string {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Extend `api.ts` with server-side fetchers**

Append to `apps/web/src/lib/api.ts`:

```typescript
export interface Subscription {
  id: string;
  productSlug: string;
  intervalDays: number;
  unitPrice: number;
  quantity: number;
  market: string;
  currency: string;
  status:
    | "active"
    | "paused"
    | "canceled"
    | "past_due"
    | "delayed_oos";
  nextBillingDate: string;
  createdAt: string;
  updatedAt: string;
  canceledAt: string | null;
}

export interface OrderItemSummary {
  productSlug: string;
  name: string;
  unitPrice: number;
  quantity: number;
  isSubscription: boolean;
  intervalDays: number | null;
}

export interface Order {
  id: string;
  createdAt: string;
  status: string;
  market: string;
  currency: string;
  subtotal: number;
  discountAmount: number;
  tax: number;
  shipping: number;
  total: number;
  paymentChargeId: string | null;
  items: OrderItemSummary[];
}

interface FetchListInput {
  token: string;
  apiUrl: string;
}

async function fetchJson<T>(
  url: string,
  token: string,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
  } catch (err) {
    throw new ApiError(
      "network",
      err instanceof Error ? err.message : "network error",
      0,
    );
  }
  if (!res.ok) {
    let body: BackendErrorBody | undefined;
    try {
      body = (await res.json()) as BackendErrorBody;
    } catch {
      body = undefined;
    }
    const code = body?.error?.code ?? "unknown";
    const message = body?.error?.message ?? `request failed: ${res.status}`;
    throw new ApiError(code, message, res.status, body?.error?.details);
  }
  return (await res.json()) as T;
}

export async function fetchSubscriptions({
  token,
  apiUrl,
}: FetchListInput): Promise<Subscription[]> {
  const data = await fetchJson<{ subscriptions: Subscription[] }>(
    `${apiUrl}/me/subscriptions`,
    token,
  );
  return data.subscriptions;
}

export async function fetchOrders({
  token,
  apiUrl,
}: FetchListInput): Promise<Order[]> {
  const data = await fetchJson<{ orders: Order[] }>(
    `${apiUrl}/me/orders`,
    token,
  );
  return data.orders;
}
```

Note: the existing `fetchCustomer` stays as-is — it's structurally slightly different (returns a single object, not `{orders: [...]}`) and changing it would be an unrelated refactor. A future follow-up could port it to `fetchJson`.

- [ ] **Step 5: Create `api-client.ts` for mutations**

`apps/web/src/lib/api-client.ts`:

```typescript
import { ApiError, type Subscription } from "./api";

interface MutationBase {
  token: string;
  apiUrl: string;
  id: string;
}

async function postMutation(
  path: string,
  token: string,
  body?: unknown,
): Promise<Subscription> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError(
      "network",
      err instanceof Error ? err.message : "network error",
      0,
    );
  }
  if (!res.ok) {
    let parsed: { error: { code: string; message: string; details?: unknown } } | undefined;
    try {
      parsed = (await res.json()) as typeof parsed;
    } catch {
      parsed = undefined;
    }
    throw new ApiError(
      parsed?.error?.code ?? "unknown",
      parsed?.error?.message ?? `request failed: ${res.status}`,
      res.status,
      parsed?.error?.details,
    );
  }
  return (await res.json()) as Subscription;
}

export function pauseSubscription({ token, apiUrl, id }: MutationBase) {
  return postMutation(`${apiUrl}/me/subscriptions/${id}/pause`, token);
}

export function resumeSubscription({ token, apiUrl, id }: MutationBase) {
  return postMutation(`${apiUrl}/me/subscriptions/${id}/resume`, token);
}

export function cancelSubscription({ token, apiUrl, id }: MutationBase) {
  return postMutation(`${apiUrl}/me/subscriptions/${id}/cancel`, token);
}

export interface ChangeFrequencyInput extends MutationBase {
  intervalDays: 30 | 60 | 90;
}

export function changeFrequency({
  token,
  apiUrl,
  id,
  intervalDays,
}: ChangeFrequencyInput) {
  return postMutation(
    `${apiUrl}/me/subscriptions/${id}/frequency`,
    token,
    { intervalDays },
  );
}
```

- [ ] **Step 6: Extend i18n messages**

Replace `apps/web/messages/es.json`:

```json
{
  "home": {
    "title": "Novapatch",
    "subtitle": "Parches vitamínicos por suscripción.",
    "cta_cuenta": "Ver mi cuenta"
  },
  "cuenta": {
    "title": "Mi cuenta",
    "email_label": "Correo",
    "member_since_label": "Cliente desde",
    "loading": "Cargando...",
    "nav": {
      "perfil": "Perfil",
      "suscripciones": "Suscripciones",
      "pedidos": "Pedidos"
    },
    "status": {
      "active": "Activa",
      "paused": "Pausada",
      "canceled": "Cancelada",
      "past_due": "Pago pendiente",
      "delayed_oos": "Demorada",
      "paid": "Pagado",
      "failed": "Fallido",
      "refunded": "Reembolsado"
    },
    "subscriptions": {
      "next_billing": "Próximo cobro",
      "every_days": "Cada {days} días",
      "actions": {
        "pause": "Pausar",
        "resume": "Reanudar",
        "change_frequency": "Cambiar frecuencia",
        "cancel": "Cancelar",
        "confirm": "Confirmar",
        "back": "Volver"
      },
      "frequency_options": {
        "every_30": "Cada mes (30 días)",
        "every_60": "Cada 2 meses (60 días)",
        "every_90": "Cada 3 meses (90 días)"
      },
      "frequency_dialog": {
        "title": "Cambiar frecuencia",
        "body": "Con esta frecuencia, tu próximo cobro será el {date}. ¿Confirmar?"
      },
      "cancel_dialog": {
        "title": "Cancelar suscripción",
        "body": "Al cancelar, no recibirás más envíos. Esta acción no se puede deshacer.",
        "confirm": "Cancelar suscripción",
        "back": "Volver"
      },
      "toasts": {
        "paused": "Suscripción pausada",
        "resumed": "Suscripción reanudada — próximo cobro: {date}",
        "canceled": "Suscripción cancelada",
        "frequency_changed": "Frecuencia actualizada — próximo cobro: {date}",
        "session_expired": "Tu sesión expiró. Recargá la página.",
        "generic_error": "Ocurrió un error: {code}"
      },
      "empty": "Aún no tienes suscripciones activas.",
      "shop_cta": "Ver tienda"
    },
    "orders": {
      "order_label": "Pedido #{id}",
      "subtotal": "Subtotal",
      "discount": "Descuento",
      "tax": "Impuestos",
      "shipping": "Envío",
      "total": "Total",
      "subscription_chip": "Suscripción cada {days} días",
      "empty": "No tienes pedidos todavía."
    },
    "errors": {
      "title": "No pudimos cargar tu información",
      "retry": "Reintentar"
    }
  },
  "nav": {
    "mi_cuenta": "Mi cuenta",
    "iniciar_sesion": "Iniciar sesión"
  }
}
```

- [ ] **Step 7: Mount `<Toaster />` in the root layout**

Edit `apps/web/src/app/[locale]/layout.tsx`. Add the import:

```typescript
import { Toaster } from "@/components/ui/sonner";
```

Inside `<NextIntlClientProvider>`, after `{children}` and before the closing `</NextIntlClientProvider>`:

```tsx
            <Toaster position="bottom-right" richColors />
```

Full updated `<body>` should look like:

```tsx
<body>
  <NextIntlClientProvider>
    <header className="flex items-center justify-between border-b border-gray-200 p-4">
      {/* existing header content unchanged */}
    </header>
    {children}
    <Toaster position="bottom-right" richColors />
  </NextIntlClientProvider>
</body>
```

- [ ] **Step 8: Run typecheck + smoke**

```bash
cd apps/web && pnpm typecheck
```

Expected: clean. If sonner's types aren't found, run `pnpm install` first.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/ui apps/web/src/lib/money.ts apps/web/src/lib/dates.ts apps/web/src/lib/api.ts apps/web/src/lib/api-client.ts apps/web/messages/es.json apps/web/src/app/[locale]/layout.tsx apps/web/package.json apps/web/components.json pnpm-lock.yaml
git commit -m "feat(web): shadcn components + api-client + money/date utils + i18n keys"
```

If the `components.json` file wasn't touched, just drop it from the add list.

---

## Task 3: `/cuenta/layout.tsx` + Perfil + Pedidos page

**Files:**
- Create: `apps/web/src/components/cuenta/cuenta-nav.tsx`
- Create: `apps/web/src/components/cuenta/status-badge.tsx`
- Create: `apps/web/src/components/cuenta/orders-list.tsx`
- Create: `apps/web/src/app/[locale]/cuenta/layout.tsx`
- Create: `apps/web/src/app/[locale]/cuenta/pedidos/page.tsx`
- Create: `apps/web/src/app/[locale]/cuenta/pedidos/loading.tsx`
- Create: `apps/web/src/app/[locale]/cuenta/pedidos/error.tsx`
- Modify: `apps/web/src/app/[locale]/cuenta/page.tsx` — drop outer layout wrappers (now owned by `layout.tsx`)

- [ ] **Step 1: Create `<CuentaNav />`**

`apps/web/src/components/cuenta/cuenta-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

interface CuentaNavProps {
  locale: string;
}

export function CuentaNav({ locale }: CuentaNavProps) {
  const t = useTranslations("cuenta.nav");
  const pathname = usePathname();
  const base = `/${locale}/cuenta`;

  const items = [
    { href: base, label: t("perfil") },
    { href: `${base}/suscripciones`, label: t("suscripciones") },
    { href: `${base}/pedidos`, label: t("pedidos") },
  ];

  return (
    <nav className="flex gap-4 border-b border-gray-200 pb-2">
      {items.map((item) => {
        const isActive =
          item.href === base ? pathname === base : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              isActive
                ? "text-sm font-semibold underline underline-offset-4"
                : "text-sm text-muted-foreground hover:underline"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Create `<StatusBadge />`**

`apps/web/src/components/cuenta/status-badge.tsx`:

```tsx
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

type Variant = "default" | "secondary" | "outline" | "destructive";

const VARIANT_BY_STATUS: Record<string, Variant> = {
  active: "default",
  paused: "secondary",
  canceled: "outline",
  past_due: "destructive",
  delayed_oos: "secondary",
  paid: "default",
  failed: "destructive",
  refunded: "outline",
};

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("cuenta.status");
  const variant = VARIANT_BY_STATUS[status] ?? "secondary";
  // next-intl's `t()` throws on missing keys; fall back to the raw status
  // for forward compatibility with backend-added statuses.
  let label = status;
  try {
    label = t(status);
  } catch {
    label = status;
  }
  return <Badge variant={variant}>{label}</Badge>;
}
```

- [ ] **Step 3: Create `<OrdersList />` (server-renderable, no interactivity)**

`apps/web/src/components/cuenta/orders-list.tsx`:

```tsx
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { Order } from "@/lib/api";
import { toBcp47 } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { StatusBadge } from "./status-badge";

function shortId(id: string): string {
  return id.slice(0, 8);
}

export async function OrdersList({
  orders,
  locale,
}: {
  orders: Order[];
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "cuenta.orders" });
  const bcp = toBcp47(locale);

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
        <Link
          href={`/${locale}/tienda`}
          className="text-sm underline underline-offset-4"
        >
          {/* reuses the subscriptions shop CTA copy — same target */}
          Ver tienda
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {orders.map((o) => (
        <Card key={o.id}>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">
                {t("order_label", { id: shortId(o.id) })}
              </CardTitle>
              <CardDescription>{formatDate(o.createdAt, bcp)}</CardDescription>
            </div>
            <StatusBadge status={o.status} />
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="flex flex-col gap-1">
              {o.items.map((it, idx) => (
                <li key={idx} className="flex justify-between">
                  <span>
                    {it.name} × {it.quantity}
                    {it.isSubscription && it.intervalDays !== null ? (
                      <span className="text-muted-foreground ml-2">
                        ({t("subscription_chip", { days: it.intervalDays })})
                      </span>
                    ) : null}
                  </span>
                  <span>
                    {formatMoney(it.unitPrice * it.quantity, o.currency, bcp)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter className="flex flex-col gap-1 text-sm">
            <Row label={t("subtotal")} value={formatMoney(o.subtotal, o.currency, bcp)} />
            {o.discountAmount > 0 ? (
              <Row
                label={t("discount")}
                value={`- ${formatMoney(o.discountAmount, o.currency, bcp)}`}
              />
            ) : null}
            <Row label={t("tax")} value={formatMoney(o.tax, o.currency, bcp)} />
            <Row label={t("shipping")} value={formatMoney(o.shipping, o.currency, bcp)} />
            <Row
              label={t("total")}
              value={formatMoney(o.total, o.currency, bcp)}
              bold
            />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex w-full justify-between ${
        bold ? "font-semibold" : "text-muted-foreground"
      }`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
```

- [ ] **Step 4: Create the cuenta layout**

`apps/web/src/app/[locale]/cuenta/layout.tsx`:

```tsx
import { getTranslations } from "next-intl/server";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { CuentaNav } from "@/components/cuenta/cuenta-nav";

export default async function CuentaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cuenta" });

  return (
    <main className="min-h-screen p-6 md:p-12">
      <Card className="mx-auto max-w-3xl">
        <CardHeader className="flex flex-col gap-4">
          <CardTitle>{t("title")}</CardTitle>
          <CuentaNav locale={locale} />
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 5: Slim down the Perfil page to fit under the new layout**

Replace `apps/web/src/app/[locale]/cuenta/page.tsx` with:

```tsx
import { auth } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { fetchCustomer, ApiError } from "@/lib/api";
import { toBcp47 } from "@/lib/i18n";

export default async function CuentaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cuenta" });

  const { userId, getToken } = await auth();
  if (!userId) {
    redirect(`/${locale}`);
  }
  const token = await getToken();
  if (!token) {
    redirect(`/${locale}`);
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }

  let customer;
  let error: ApiError | undefined;
  try {
    customer = await fetchCustomer({ token, apiUrl });
  } catch (err) {
    if (err instanceof ApiError) {
      error = err;
    } else {
      throw err;
    }
  }

  if (error) {
    return (
      <p className="text-destructive text-sm">
        {error.code}: {error.message}
      </p>
    );
  }
  if (!customer) {
    return <p className="text-muted-foreground text-sm">{t("loading")}</p>;
  }

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      <dt className="text-muted-foreground">{t("email_label")}</dt>
      <dd>{customer.email}</dd>
      <dt className="text-muted-foreground">{t("member_since_label")}</dt>
      <dd>{new Date(customer.createdAt).toLocaleDateString(toBcp47(locale))}</dd>
    </dl>
  );
}
```

The difference from the current file: removed `<main>` + outer `<Card>` wrappers (layout owns them). Logic is identical.

- [ ] **Step 6: Create the Pedidos page**

`apps/web/src/app/[locale]/cuenta/pedidos/page.tsx`:

```tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { fetchOrders, ApiError } from "@/lib/api";
import { OrdersList } from "@/components/cuenta/orders-list";

export default async function PedidosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const { userId, getToken } = await auth();
  if (!userId) redirect(`/${locale}`);
  const token = await getToken();
  if (!token) redirect(`/${locale}`);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }

  try {
    const orders = await fetchOrders({ token, apiUrl });
    return <OrdersList orders={orders} locale={locale} />;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err; // handled by error.tsx below
    }
    throw err;
  }
}
```

- [ ] **Step 7: Create Pedidos loading + error boundaries**

`apps/web/src/app/[locale]/cuenta/pedidos/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
```

`apps/web/src/app/[locale]/cuenta/pedidos/error.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("cuenta.errors");
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-destructive text-sm">{t("title")}</p>
      <p className="text-muted-foreground text-xs">{error.message}</p>
      <Button variant="outline" size="sm" onClick={() => reset()}>
        {t("retry")}
      </Button>
    </div>
  );
}
```

- [ ] **Step 8: Typecheck + smoke**

```bash
cd apps/web && pnpm typecheck && pnpm build
```

Expected: typecheck clean; `pnpm build` completes without errors.

If `build` hits a route-missing error for `cuenta/suscripciones` (because Task 4 hasn't landed), that's fine — skip `pnpm build` until Task 4.

Run in-browser smoke:

```bash
cd apps/web && pnpm dev
```

Visit `/mx/cuenta` (should show Perfil under the new shell), then `/mx/cuenta/pedidos` (should show the orders list or the empty state). `/mx/cuenta/suscripciones` will 404 until Task 4.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/cuenta apps/web/src/app/[locale]/cuenta
git commit -m "feat(web): /cuenta layout + nav + Perfil slim-down + Pedidos page"
```

---

## Task 4: `/cuenta/suscripciones` with all 4 actions

**Files:**
- Create: `apps/web/src/components/cuenta/subscription-card.tsx` (Client — per-sub interactive card)
- Create: `apps/web/src/components/cuenta/subscriptions-list.tsx` (Client — wraps the mutations prop)
- Create: `apps/web/src/app/[locale]/cuenta/suscripciones/page.tsx`
- Create: `apps/web/src/app/[locale]/cuenta/suscripciones/loading.tsx`
- Create: `apps/web/src/app/[locale]/cuenta/suscripciones/error.tsx`

- [ ] **Step 1: Create `<SubscriptionCard />`**

`apps/web/src/components/cuenta/subscription-card.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { Subscription } from "@/lib/api";
import { ApiError } from "@/lib/api";
import {
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  changeFrequency,
} from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import { formatDate, addDaysUtc } from "@/lib/dates";
import { toBcp47 } from "@/lib/i18n";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "./status-badge";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface Props {
  sub: Subscription;
  locale: string;
  apiUrl: string;
}

export function SubscriptionCard({ sub, locale, apiUrl }: Props) {
  const t = useTranslations("cuenta.subscriptions");
  const bcp = toBcp47(locale);
  const router = useRouter();
  const { getToken } = useAuth();

  const [inFlight, setInFlight] = useState(false);
  const [pendingInterval, setPendingInterval] = useState<30 | 60 | 90 | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  async function withToken(fn: (token: string) => Promise<unknown>, toastMessage: string) {
    const token = await getToken();
    if (!token) {
      toast.error(t("toasts.session_expired"));
      return;
    }
    setInFlight(true);
    try {
      await fn(token);
      toast.success(toastMessage);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) toast.error(t("toasts.session_expired"));
        else toast.error(t("toasts.generic_error", { code: err.code }));
      } else {
        toast.error(t("toasts.generic_error", { code: "unknown" }));
      }
    } finally {
      setInFlight(false);
    }
  }

  async function onPause() {
    await withToken(
      (token) => pauseSubscription({ token, apiUrl, id: sub.id }),
      t("toasts.paused"),
    );
  }

  async function onResume() {
    const nextDate = addDaysUtc(new Date(), sub.intervalDays);
    await withToken(
      (token) => resumeSubscription({ token, apiUrl, id: sub.id }),
      t("toasts.resumed", { date: formatDate(nextDate, bcp) }),
    );
  }

  async function onConfirmFrequency() {
    if (pendingInterval === null) return;
    const chosen = pendingInterval;
    const nextDate = addDaysUtc(new Date(), chosen);
    await withToken(
      (token) => changeFrequency({ token, apiUrl, id: sub.id, intervalDays: chosen }),
      t("toasts.frequency_changed", { date: formatDate(nextDate, bcp) }),
    );
    setPendingInterval(null);
  }

  async function onConfirmCancel() {
    await withToken(
      (token) => cancelSubscription({ token, apiUrl, id: sub.id }),
      t("toasts.canceled"),
    );
    setCancelOpen(false);
  }

  const isTerminal = sub.status === "canceled";
  const isBillingIssue = sub.status === "past_due" || sub.status === "delayed_oos";
  const canPause = sub.status === "active";
  const canResume = sub.status === "paused";
  const canChangeFrequency = sub.status === "active" || sub.status === "paused";
  const canCancel = !isTerminal;

  const intervalOptions: Array<{ value: 30 | 60 | 90; labelKey: string }> = [
    { value: 30, labelKey: "every_30" },
    { value: 60, labelKey: "every_60" },
    { value: 90, labelKey: "every_90" },
  ];

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">{capitalize(sub.productSlug)}</CardTitle>
            <CardDescription>
              {t("every_days", { days: sub.intervalDays })} ·{" "}
              {formatMoney(sub.unitPrice, sub.currency, bcp)}
            </CardDescription>
          </div>
          <StatusBadge status={sub.status} />
        </CardHeader>
        <CardContent className="text-sm">
          {!isTerminal && (
            <p className="text-muted-foreground">
              {t("next_billing")}: {formatDate(sub.nextBillingDate, bcp)}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          {canPause && (
            <Button size="sm" variant="outline" onClick={onPause} disabled={inFlight}>
              {t("actions.pause")}
            </Button>
          )}
          {canResume && (
            <Button size="sm" onClick={onResume} disabled={inFlight}>
              {t("actions.resume")}
            </Button>
          )}
          {canChangeFrequency && (
            <Select
              disabled={inFlight}
              value={String(sub.intervalDays)}
              onValueChange={(v) => {
                const n = Number(v) as 30 | 60 | 90;
                if (n !== sub.intervalDays) setPendingInterval(n);
              }}
            >
              <SelectTrigger className="h-9 w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {intervalOptions.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {t(`frequency_options.${opt.labelKey}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {canCancel && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setCancelOpen(true)}
              disabled={inFlight}
            >
              {t("actions.cancel")}
            </Button>
          )}
          {isBillingIssue && (
            <span className="text-muted-foreground text-xs">
              {/* Only cancel is shown for billing-issue statuses; no extra copy needed */}
            </span>
          )}
        </CardFooter>
      </Card>

      {/* Frequency confirm dialog */}
      <Dialog
        open={pendingInterval !== null}
        onOpenChange={(open) => {
          if (!open) setPendingInterval(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("frequency_dialog.title")}</DialogTitle>
            <DialogDescription>
              {pendingInterval !== null
                ? t("frequency_dialog.body", {
                    date: formatDate(addDaysUtc(new Date(), pendingInterval), bcp),
                  })
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingInterval(null)}
              disabled={inFlight}
            >
              {t("actions.back")}
            </Button>
            <Button onClick={onConfirmFrequency} disabled={inFlight}>
              {t("actions.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirm alert dialog */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cancel_dialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("cancel_dialog.body")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={inFlight}>
              {t("cancel_dialog.back")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmCancel}
              disabled={inFlight}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("cancel_dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

- [ ] **Step 2: Create `<SubscriptionsList />`**

`apps/web/src/components/cuenta/subscriptions-list.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Subscription } from "@/lib/api";
import { SubscriptionCard } from "./subscription-card";

export function SubscriptionsList({
  subscriptions,
  locale,
  apiUrl,
}: {
  subscriptions: Subscription[];
  locale: string;
  apiUrl: string;
}) {
  const t = useTranslations("cuenta.subscriptions");

  if (subscriptions.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
        <Link
          href={`/${locale}/tienda`}
          className="text-sm underline underline-offset-4"
        >
          {t("shop_cta")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {subscriptions.map((s) => (
        <SubscriptionCard key={s.id} sub={s} locale={locale} apiUrl={apiUrl} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create the Suscripciones page**

`apps/web/src/app/[locale]/cuenta/suscripciones/page.tsx`:

```tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { fetchSubscriptions, ApiError } from "@/lib/api";
import { SubscriptionsList } from "@/components/cuenta/subscriptions-list";

export default async function SuscripcionesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const { userId, getToken } = await auth();
  if (!userId) redirect(`/${locale}`);
  const token = await getToken();
  if (!token) redirect(`/${locale}`);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }

  try {
    const subscriptions = await fetchSubscriptions({ token, apiUrl });
    return (
      <SubscriptionsList
        subscriptions={subscriptions}
        locale={locale}
        apiUrl={apiUrl}
      />
    );
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw err;
  }
}
```

- [ ] **Step 4: Create Suscripciones loading + error boundaries**

`apps/web/src/app/[locale]/cuenta/suscripciones/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
```

`apps/web/src/app/[locale]/cuenta/suscripciones/error.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("cuenta.errors");
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-destructive text-sm">{t("title")}</p>
      <p className="text-muted-foreground text-xs">{error.message}</p>
      <Button variant="outline" size="sm" onClick={() => reset()}>
        {t("retry")}
      </Button>
    </div>
  );
}
```

- [ ] **Step 5: Typecheck + build**

```bash
cd apps/web && pnpm typecheck && pnpm build
```

Expected: typecheck clean, `pnpm build` completes.

- [ ] **Step 6: Smoke test in browser**

```bash
# Ensure API is running on :9000 (see the top-level README / dev workflow)
cd apps/web && pnpm dev
```

In the browser, logged in as a real Clerk user:

1. Visit `/mx/cuenta` — Perfil tab shows customer info under the new shell. Nav shows all 3 tabs with Perfil highlighted.
2. Click **Suscripciones**. Empty state appears if the customer has no subs. Seed one by hitting `POST /me/checkout` (or use an existing one).
3. Click **Pausar** on an active sub → toast "Suscripción pausada", status badge updates to "Pausada" after refresh.
4. Click **Reanudar** → toast "Suscripción reanudada — próximo cobro: …", status → Activa.
5. Change the **Frequency** select → dialog opens showing the new next-billing date → Confirmar → toast + updated.
6. Click **Cancelar** → alert dialog → Cancelar suscripción → toast + badge → Cancelada, no more action buttons visible.
7. Click **Pedidos** — the existing orders render (from the demo or any real checkout).

If any step fails, fix the root cause and re-test. Do not paper over with try/catch.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/cuenta apps/web/src/app/[locale]/cuenta/suscripciones
git commit -m "feat(web): /cuenta/suscripciones list + pause/resume/frequency/cancel actions"
```

---

## Self-Review (controller has already done this, no action here)

- **Spec coverage:** `/me/orders` ✓ (Task 1). `/cuenta` layout + nav + 3 routes ✓ (Task 3, Task 4). Action UX per spec (pause/resume inline, frequency dialog with preview, cancel AlertDialog) ✓ (Task 4). Empty states + error boundaries ✓. Shadcn additions ✓ (Task 2). i18n keys ✓ (Task 2).
- **Placeholders:** none.
- **Type consistency:** `Subscription` shape is the same between `api.ts` server fetcher and `api-client.ts` mutations. `Order`/`OrderItemSummary` match the backend `serializeOrder`. `intervalDays` is `number` everywhere except the mutation input where we narrow it to `30 | 60 | 90`.

---

## Follow-ups (intentionally out of scope)

- Order detail page (`/cuenta/pedidos/:id`) with Envia tracking + invoice download.
- Edit shipping address on subscriptions.
- "Retry charge" on `past_due` (needs real gateway).
- Export orders CSV.
- Playwright E2E (login → pause → cancel flow).
- Pagination on both lists.
- Cursor-style optimistic updates (currently `router.refresh()` round-trips).
- Port `fetchCustomer` onto the shared `fetchJson` helper in `api.ts`.
- Translations for additional markets (`br`, `ar`, `cl`, `co`).
