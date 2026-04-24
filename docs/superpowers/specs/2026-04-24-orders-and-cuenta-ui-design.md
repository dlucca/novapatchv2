# Orders Endpoint + `/cuenta` UI — Design Spec

**Status:** Approved — ready for implementation plan.
**Scope:** Add `GET /me/orders` to the API and build the authenticated customer area at `/[locale]/cuenta/*` with three routes: Perfil (existing), Suscripciones (list + actions), Pedidos (history).

---

## Goals

1. A customer can see their order history at a stable URL (`/mx/cuenta/pedidos`).
2. A customer can see their subscriptions at a stable URL (`/mx/cuenta/suscripciones`) and trigger pause, resume, cancel, and frequency-change actions from the UI.
3. The navigation between Perfil / Suscripciones / Pedidos is clear, linkable, and uses Next.js App Router conventions.
4. Destructive actions (cancel) require explicit confirmation. Frequency changes show the new billing date for confirmation. Pause/resume are one-click.

## Non-Goals

- Pagination on the two lists (YAGNI — typical customers won't have 50+ records).
- Order detail page (`/cuenta/pedidos/:id`).
- Retry-failed-charge, refund, or invoice-download actions.
- Address editing on existing subscriptions.
- Playwright E2E tests.
- Admin surface for orders/subscriptions.

---

## Backend — `GET /me/orders`

**Auth:** Clerk JWT required. Same middleware path as the rest of `/me/*`.

**Request:**
```
GET /me/orders
Authorization: Bearer <clerk_jwt>
```

**Response 200:**
```json
{
  "orders": [
    {
      "id": "uuid",
      "createdAt": "2026-04-24T20:36:37.000Z",
      "status": "paid",
      "market": "mx",
      "currency": "MXN",
      "subtotal": 45000,
      "discountAmount": 0,
      "tax": 7200,
      "shipping": 8500,
      "total": 60700,
      "paymentChargeId": "stub_abc",
      "items": [
        {
          "productSlug": "energy",
          "name": "Energy",
          "unitPrice": 45000,
          "quantity": 1,
          "isSubscription": false,
          "intervalDays": null
        }
      ]
    }
  ]
}
```

- Ordered by `createdAt DESC`.
- `items` embedded per order (one query for orders + one query for items, mapped in-memory by `orderId`). No JOIN — the in-memory fan-out is simpler to reason about for v1.
- Empty customer: `{ "orders": [] }` with status 200 (no 404).

**Errors:** 401 `auth_*` only. No other status codes from this endpoint.

**Implementation additions:**
- `apps/api/src/repos/orders.ts` gains `listOrdersWithItemsByCustomerId(db, customerId): Promise<OrderWithItems[]>`.
- `apps/api/src/routes/me.ts` mounts a new sub-route (or the same file gains a `GET /orders` handler — decision deferred to the plan, but the factory pattern used elsewhere fits: `createOrderRoutes({db, userClient})` mounted under `/me/orders`). This keeps `me.ts` from growing further.

---

## Frontend — `/cuenta/*` route structure

```
apps/web/src/app/[locale]/cuenta/
├── layout.tsx              # Shared shell + <CuentaNav />
├── page.tsx                # Perfil (existing — moved under the new layout)
├── suscripciones/
│   └── page.tsx            # Server Component: fetches subs, renders list
└── pedidos/
    └── page.tsx            # Server Component: fetches orders, renders list
```

All three pages are Server Components. They call `auth().getToken()` server-side and fetch from the backend with `cache: "no-store"` (per-user data — never cached).

`cuenta/layout.tsx` wraps children with a shared shell:

```
<main className="min-h-screen p-6 md:p-12">
  <Card className="mx-auto max-w-3xl">
    <CardHeader>
      <CardTitle>Mi cuenta</CardTitle>
      <CuentaNav />
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
</main>
```

`<CuentaNav />` is a Client Component (uses `usePathname()` to highlight the active tab). Renders three `<Link>`s from `next-intl/link` pointing at `/cuenta`, `/cuenta/suscripciones`, `/cuenta/pedidos`. Active link gets an underline + bold; inactive are muted.

Each sub-route gets its own `loading.tsx` (shadcn `Skeleton`) and `error.tsx` (renders the `ApiError.code` + a "Reintentar" button that triggers `router.refresh()`).

---

## Frontend — components

### `<SubscriptionsList subscriptions={Subscription[]}>` (Client)

Receives the server-fetched array. Renders one `Card` per subscription with:

- Header: product name (capitalized slug) + `<StatusBadge status={s.status} />`.
- Meta: `Cada {intervalDays} días · ${formatMoney(unitPrice, currency, locale)} · Próximo cobro: {formatDate(nextBillingDate, locale)}`.
- Actions, only for non-terminal statuses (`canceled` shows only a muted label):
  - **Pausar / Reanudar** (context-dependent): one-click button. On success, shows a sonner toast (`"Suscripción pausada"` / `"Suscripción reanudada — próximo cobro: {date}"`) and calls `router.refresh()` to re-fetch.
  - **Cambiar frecuencia**: a `Select` with options 30 / 60 / 90 labeled "Cada mes / Cada 2 meses / Cada 3 meses". Selecting a value opens a shadcn `Dialog` showing "Con esta frecuencia tu próximo cobro será el {computed date}. ¿Confirmar?" with Confirmar / Cancelar buttons. The client precomputes the new date locally (today + new interval) since the backend result is deterministic — no need to preview-fetch. On confirm, POST `/frequency`, show toast, `router.refresh()`.
  - **Cancelar**: destructive variant, opens shadcn `AlertDialog`: `"Al cancelar esta suscripción no recibirás más envíos. Esta acción no se puede deshacer."` with Cancelar subscripción / Volver buttons. On confirm, POST `/cancel`, show toast, `router.refresh()`.
- Action visibility follows the status matrix from the subscription self-service spec. E.g. a `past_due` sub shows only Cancelar.

Empty state: "Aún no tienes suscripciones activas." + link to `/mx/tienda`.

### `<OrdersList orders={OrderWithItems[]}>` (can be Server-rendered — no interaction)

One `Card` per order with:

- Header: `Pedido #{shortId(id)}` + `{formatDate(createdAt, locale)}` + `<StatusBadge status={status} />`.
- Items: `<ul>` with `{item.name} × {item.quantity} — {formatMoney(item.unitPrice * item.quantity)}`, plus a subscription chip if `isSubscription`.
- Footer: totals row (Subtotal / Descuento / Impuestos / Envío / Total), formatted as money.

Empty state: "No tienes pedidos todavía." + link to `/mx/tienda`.

### `<StatusBadge status={string}>`

Maps statuses to shadcn `Badge` variants:

| status | variant | label |
|---|---|---|
| `active` | default (green-tinted) | "Activa" |
| `paused` | secondary | "Pausada" |
| `canceled` | outline (muted) | "Cancelada" |
| `past_due` | destructive | "Pago pendiente" |
| `delayed_oos` | secondary | "Demorada" |
| `paid` (orders) | default | "Pagado" |
| `failed` | destructive | "Fallido" |
| `refunded` | outline | "Reembolsado" |

### `<CuentaNav />` (Client)

Three `<Link>`s. Active link determined by `usePathname()`. Responsive: on narrow viewports stays as a horizontal row with scroll (no collapse to `<Select>` in v1).

---

## API client split

- **`apps/web/src/lib/api.ts`** (existing) — Server-only fetchers (`fetchCustomer`). We add `fetchSubscriptions({token, apiUrl})` and `fetchOrders({token, apiUrl})`. These are called from Server Components.
- **`apps/web/src/lib/api-client.ts`** (new) — Client-side mutations. Exports `pauseSubscription`, `resumeSubscription`, `cancelSubscription`, `changeFrequency`. Each takes `{token, apiUrl, id, ...args}` and throws the same `ApiError` class.

Both files share the `ApiError` class (already exported from `api.ts`).

### Utilities

- **`apps/web/src/lib/money.ts`** — `formatMoney(cents: number, currency: string, locale: string): string`. Uses `Intl.NumberFormat(locale, { style: "currency", currency })`, divides cents by 100.
- **`apps/web/src/lib/dates.ts`** — `formatDate(iso: string, locale: string): string` + `addDaysForDisplay(base: Date, days: number): Date` for the frequency-preview math.

---

## Shadcn components to add

`npx shadcn@latest add` these if not already present:

- `badge`
- `dialog`
- `alert-dialog`
- `select`
- `skeleton`
- `sonner`

Existing: `button`, `card`.

`sonner` requires a `<Toaster />` mounted once in the root layout. Add it to `apps/web/src/app/[locale]/layout.tsx`.

---

## Testing

### Backend

- `apps/api/test/routes/orders.test.ts`:
  - 401 without Authorization.
  - Empty list when the customer has no orders.
  - Returns orders sorted by `createdAt DESC`, with items embedded in each.
  - Cross-customer isolation (Alice's request never returns Bob's orders).

### Frontend

No unit tests in v1. The integration confidence comes from the backend tests + existing `/cuenta` smoke test (it currently hits `fetchCustomer` against the real API in dev). Playwright E2E is out of scope.

---

## Known behavior notes

- **Token refresh during mutations:** `useAuth().getToken()` returns a fresh JWT on each call. If a mutation fails with a 401 `auth_invalid` the toast says "Tu sesión expiró. Recarga la página." — we do not attempt a silent refresh (Clerk handles that implicitly on the next `getToken()`).
- **Optimistic updates:** not used. After every mutation we `router.refresh()` to re-fetch from the server. This keeps the UI always consistent with the DB at the cost of one round-trip per action. Good tradeoff for v1.
- **i18n strings:** all customer-facing copy goes into `apps/web/messages/es.json` under a `cuenta` namespace. Helper keys like `cuenta.actions.pause.label`, `cuenta.toasts.paused`, `cuenta.empty.subscriptions`. Consistent with the existing next-intl setup.
- **Date math for frequency preview:** the frontend mirrors the backend's `today + newIntervalDays` rule with UTC arithmetic. The resulting date shown in the dialog matches what the backend will return on confirm.

---

## Out-of-Scope Follow-ups

- Order detail page (`/cuenta/pedidos/:id`) with shipping tracking, Envia label URL, invoice download.
- "Reintentar cobro" action on `past_due` subscriptions once a real gateway is wired.
- Edit shipping address on a subscription.
- Export orders CSV.
- Playwright E2E smoke flow (login → change frequency → verify next billing date).
- Pagination on either list (cursor-based when volume requires it).
- Translation to additional markets (`br`, `ar`, `cl`, `co`) — `mx` is the launch market.
