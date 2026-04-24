# Novapatch v2

Subscription e-commerce backend + storefront for Novapatch vitamin patches (Mexico + LATAM).

## Structure

- `apps/api` — Hono + Bun backend
- `apps/web` — Next.js storefront (added in a later plan)
- `packages/markets` — market config (currency, tax, payment provider)
- `packages/catalog` — static product catalog + pricing helpers

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.1 (the API runs on Bun)
- [pnpm](https://pnpm.io) ≥ 9 (workspace management)
- Node ≥ 20 (for dev tooling)

## Setup

```bash
pnpm install
```

## Running the API

```bash
pnpm dev
```

The server listens on `http://localhost:9000`. Try:

```bash
curl 'http://localhost:9000/health'
curl 'http://localhost:9000/catalog?market=mx'
curl 'http://localhost:9000/catalog/energy?market=mx'
```

## Testing

Run every package's tests:

```bash
pnpm test
```

Run a single package:

```bash
pnpm --filter @novapatch/catalog test
pnpm --filter @novapatch/markets test
pnpm --filter @novapatch/api test
```

## Type checking

```bash
pnpm typecheck
```

Runs `tsc --noEmit` across every workspace package.

## Architecture

See [docs/superpowers/specs/](docs/superpowers/specs/) for the overall design and [docs/superpowers/plans/](docs/superpowers/plans/) for phased implementation plans.

Current phase: foundation + catalog. Upcoming: DB schema, auth, checkout, subscriptions, admin.
