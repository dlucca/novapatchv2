# Novapatch v2 — Roadmap

**Last updated:** 2026-04-27
**Source-of-truth docs:**
- [`source/PRD.md`](source/PRD.md) — product requirements (v1.0)
- [`source/DESIGN.md`](source/DESIGN.md) — design system (v1.0)

This document captures the architectural decisions taken to align the existing
`novapatchv2` codebase with the PRD + DESIGN, and the ordered roadmap of
implementation plans needed to reach MVP.

## How this document is used

- **For planning:** the "Plan order" section below is the prioritized list of
  next features. Each row becomes its own spec → plan → execution cycle via the
  `superpowers:brainstorming` → `superpowers:writing-plans` →
  `superpowers:subagent-driven-development` workflow.
- **For agents:** read this file plus the relevant sections of `source/PRD.md`
  and `source/DESIGN.md` before starting any new feature.
- **When decisions change:** update the "Decisions" table inline, append a
  short note in "Decision history", and re-commit.

---

## Decisions (2026-04-25)

These resolve every divergence between the PRD/DESIGN and the existing
codebase. They are binding for all subsequent plans unless explicitly revised.

| # | Topic | Decision | Notes |
|---|---|---|---|
| 1 | Backend architecture | **Hono `apps/api` stays.** The PRD's "Next API routes + Server Actions" line is updated to reflect Hono. | ~3 weeks of code already invested; clearer separation; Bun runtime. |
| 2 | Pricing values | **PRD wins:** 750 MXN base; subscription discounts 30d=15%, 60d=10%, 90d=5%. | Already applied — see commit "feat: align pricing to PRD (750 MXN + 15/10/5%)". |
| 3 | Pricing storage | **Code now, DB later.** Stays in `@novapatch/catalog` for v1; migrate to `region_pricing` table when admin CRUD is built (Sprint 6 PRD). | No production data yet, so deferred migration is safe. |
| 4 | MVP markets | **MX-only soft launch, AR-ready hard.** Multi-market infra (`MARKETS`, `PaymentGateway` interface, currency, copy keys) stays in code; AR is feature-flagged off in UI. Activate when MercadoPago AR account approves. | PRD sprint plan adjusts: MX live first, AR fast-follow. |
| 5 | MX gateway | **Stripe MX.** Real `StripeProvider` implementing `PaymentGateway` interface. Card Account Updater enabled. | Replaces stub. AR will use MercadoPago behind same interface. |
| 6 | PDP | **Build `/productos/[slug]`** as PRD specifies, with structured data (Product schema), full description, ingredients, claims, FAQ. | Required for ad/IG bio links and SEO. Overrides earlier "no PDP" decision in spec 2026-04-25-tienda-and-checkout-design (which is now superseded). |
| 7 | Cart UI | **Drawer (Sheet) only.** No `/cart` page. PRD updated. | Matches modern e-commerce patterns; URL-shareable cart not needed for MVP. |
| 8 | Worker location | **Endpoint inside `apps/api`** at `POST /internal/process-runs`, protected by shared-secret. Cron Railway hits it every 15min. | Can extract to `apps/worker` if scale demands it (>10k subs). |
| 9 | Admin location | **Inside `apps/web` at `/admin/*`** route group, protected by Clerk role `admin`. Dynamic imports for bundle isolation. | No second app to deploy; can split later if needed. |
| 10 | Design system upgrade | **Full upgrade now.** Outfit + Newsreader fonts via `next/font`, per-product color triads in `@theme inline`, full type scale, signature animations (descending dots, hero rotation, plan builder expand). | Foundation for everything visual; required by Tienda/PDP/Plan Builder. |
| 11 | Geo detection | **Full implementation now.** Vercel `request.geo.country` → cookie `country`, modal "Pronto en tu país" with email capture for unsupported markets, Navbar country selector that flushes the cart. | Supports both UX and lead-capture from cross-border traffic. |

### Decision history

- **2026-04-25:** initial Q&A with Diego after PRD + DESIGN review. All 11
  decisions above set.
- **2026-04-27:** **Plan #4 scope swap.** Plan #4 was originally "Tienda
  (`/tienda`) + Cart drawer + PDP". After brainstorming
  (`docs/superpowers/specs/2026-04-27-home-direction-c-design.md`) we decided
  to ship **Home (Direction C) + Cart store (`useCart`) + `<CartDrawer />`**
  as Plan #4 first — Home is the ads entry point, and pulling the cart store +
  drawer up alongside it gives every later surface (Tienda, PDP, Plan Builder,
  Checkout) a stable foundation. The original Tienda + PDP scope moved to
  **Plan #4b**, which now consumes `NOVA_PRODUCTS`, `useCart`, and
  `<CartDrawer />` from Plan #4 instead of building them. The Home page
  formerly listed as Plan #9 is removed (folded into #4). Plan #7 (Plan
  Builder) gains an explicit note that it must replace the
  `<SubscriptionTeaser />` CTA copy + `href` from `/tienda` to `/plan-builder`.

---

## Plan order

Each item below = one spec + one plan + one execution. Order respects
dependencies: earlier items unblock later ones.

| # | Plan | Status | Depends on | Why now |
|---|---|---|---|---|
| 0 | Pricing reconcile + PRD/DESIGN ingestion + ROADMAP | **done** (2026-04-25) | — | Anchors source-of-truth in repo. |
| 1 | Schema extension: `subscription_runs`, `payment_attempts`, `webhook_events`, `customers.gateway_customer_ids`, fulfillment fields on `orders` | not started | 0 | Worker, Stripe, and admin all read/write these tables. |
| 2 | Design system upgrade: fonts (Outfit + Newsreader), per-product color triads, full type scale, sombras/radii, animation primitives | not started | 0 | Tienda/PDP/Plan Builder need these tokens before they can render correctly. |
| 3 | Geo detection middleware + country cookie + Navbar selector + unsupported-country modal | not started | 0 | Independent surface; can run in parallel with #1 / #2 if needed. |
| 4 | Home (Direction C) + Cart store (`useCart`) + `<CartDrawer />` | not started | 2 | Marketing entry point for ads. Establishes shared cart store + drawer that all subsequent storefront surfaces (Tienda, PDP, Plan Builder, Checkout) consume. **Scope-swapped 2026-04-27** — originally Tienda + PDP; that work moved to Plan #4b. |
| 4b | Tienda grid page (`/tienda`) + PDP (`/productos/[slug]` with SEO) | not started | 4 | Reuses `NOVA_PRODUCTS`, `useCart`, and `<CartDrawer />` shipped in Plan #4. Adds product grid + per-slug PDP with structured data (decision #6). Replaces the now-superseded spec 2026-04-25-tienda-and-checkout-design. |
| 5 | Stripe MX integration (`StripeProvider` real, Elements client, webhooks) | not started | 1 | Required for real checkout. |
| 6 | Checkout end-to-end (`/checkout` for logged-in + `/checkout` public for guest one-time, Stripe Elements, idempotency) | not started | 4b, 5 | Closes the buying loop. |
| 7 | Plan Builder (`/suscripciones`) with bottom bar + redirect to `/checkout` | **done** (2026-04-27) | 4, 5 | Key conversion surface for subscriptions. Route lives at `/${locale}/suscripciones`; uses canonical PRD discounts (30d=20%, 60d=15%, 90d=10%) — supersedes the earlier 15/10/5 figure in decision #2. `<SubscriptionTeaser />` CTA repointed from `#productos` to `/${locale}/suscripciones`. Cart store extended with optional `CartSubscription` metadata; cart drawer renders a per-product subscription badge. Checkout redirect deferred to Plan #6. |
| 8 | Worker scheduler (`POST /internal/process-runs`) with retry policy, `FOR UPDATE SKIP LOCKED`, idempotency via `run.id` | not started | 1, 5 | Day-2 of every active subscription depends on this. |
| 10 | Admin shell + CRUD productos + edición de pricing por región | not started | 1 | Internal tools start here. |
| 11 | Admin: orders + subscriptions + customers + discounts + fulfillment queue + influencer apps | not started | 10 | Operational completeness. |
| 12 | Public forms: `/contacto`, `/reembolso`, `/influencers/aplicar` (DB persist + Resend email) | not started | — | Independent; can run any time after #2. |
| 13 | Resend transactional emails (9 templates: welcome, order confirm, sub initial, shipped, charge OK/failed, past-due, sub canceled, refund request) | not started | 5, 8 | Wire to existing event hooks. |
| 14 | QA + perf (LCP < 2.5s mobile, Lighthouse ≥ 90) + SEO (sitemap, OG, structured data) + analytics (PostHog or Vercel) + launch prep | not started | all | Final polishing pass before public launch. |

**Out-of-scope for MVP** (post-launch backlog): admin roles, CFDI/AFIP fiscal
billing, WhatsApp/SMS notifications, native mobile app, referrals program,
live chat, product variants, A/B testing, internationalization to non-Spanish
locales, subscription product-swap.

---

## Files & locations

- **PRD**: [`source/PRD.md`](source/PRD.md)
- **DESIGN**: [`source/DESIGN.md`](source/DESIGN.md)
- **Specs** (one per plan): `docs/superpowers/specs/YYYY-MM-DD-<feature>-design.md`
- **Plans** (one per plan): `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`
- **Superseded**: `docs/superpowers/specs/2026-04-25-tienda-and-checkout-design.md` (replaced by plans #4 and #6 of this roadmap; see decision #6 and #7 above for the changes).

## Conventions

- **Commits:** Conventional Commits style (`feat:`, `fix:`, `docs:`, `chore:`).
- **Branches:** one branch per plan, named `feat/<plan-slug>`, merged to `main`
  after final-pass code review.
- **Tests:** TDD; bun-test in API, manual smoke in web (Playwright deferred).
- **i18n:** all customer-facing strings in `apps/web/messages/es.json` keyed by
  page + section. Currently only `es-MX`; `es-AR` added when AR activates.
