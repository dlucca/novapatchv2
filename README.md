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
