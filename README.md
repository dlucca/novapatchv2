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
- Docker (local Postgres via `docker compose`)

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Create your local env file (gitignored)
cp .env.example .env

# 3. Let apps/api find the env when Bun runs from a subpackage
ln -sf ../../.env apps/api/.env

# 3b. Same trick for the web app — Next.js also reads .env from its package dir.
ln -sf ../../.env apps/web/.env

# 4. Start local Postgres
docker compose up -d postgres

# 5. Apply migrations to the dev DB
pnpm --filter @novapatch/api db:migrate

# 6. Create the test DB (one-time, safe to re-run — errors on exists are fine)
docker exec -i novapatchv2-postgres psql -U novapatch -d novapatch \
  -c "CREATE DATABASE novapatch_test;" 2>/dev/null || true
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

## Running the frontend

Start Next.js on port 3000:

```bash
pnpm --filter @novapatch/web dev
```

With the API running on port 9000 and a real Clerk key in `.env`, sign in via the header button and visit `/mx/cuenta` to see your customer row.

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
