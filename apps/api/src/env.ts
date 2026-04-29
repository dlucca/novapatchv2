import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(9000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /**
   * Comma-separated list of allowed CORS origins.
   * Dev default: localhost:3000 (storefront). Override in prod via env.
   */
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((s) =>
      s
        .split(",")
        .map((o) => o.trim())
        .filter((o) => o.length > 0),
    ),

  // Forward declarations — consumed by later plans (DB, auth, payments, email).
  // Kept optional here so the API boots without them until each subsystem lands.
  DATABASE_URL: z.string().optional(),
  DATABASE_URL_TEST: z.string().optional(),

  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),

  OPENPAY_MERCHANT_ID: z.string().optional(),
  OPENPAY_PRIVATE_KEY: z.string().optional(),
  OPENPAY_PUBLIC_KEY: z.string().optional(),

  // Stripe (MX/global). When set, the API uses StripeGateway (confirm-PI flow);
  // when absent, falls back to the in-memory stub gateway (dev/test only).
  STRIPE_SECRET_KEY: z.string().optional(),

  // Shared secret for trusted server-to-server calls into apps/api
  // (e.g. apps/web Stripe webhook → POST /webhook/checkout). When unset, the
  // /webhook/* routes are not mounted and guest checkout via webhook is disabled.
  // Must be at least 32 chars; rotate periodically.
  WEBHOOK_SHARED_SECRET: z.string().min(32).optional(),

  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADOPAGO_PUBLIC_KEY: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),

  ENVIA_API_KEY: z.string().optional(),

  SENTRY_DSN: z.string().optional(),
  POSTHOG_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function readEnv(source: Record<string, string | undefined> = process.env): Env {
  return envSchema.parse(source);
}
