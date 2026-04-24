import { beforeAll, beforeEach } from "bun:test";
import { sql } from "drizzle-orm";
import { createDb, type Db } from "../../src/db";
import { runMigrations } from "../../src/db/migrate";
import { readEnv } from "../../src/env";

let cached: { db: Db; client: ReturnType<typeof import("postgres")> } | undefined;

function getTestUrl(): string {
  const env = readEnv();
  const url = env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error(
      "DATABASE_URL_TEST is required for integration tests. Set it in .env (see .env.example).",
    );
  }
  if (env.DATABASE_URL && url === env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL_TEST must differ from DATABASE_URL — tests truncate tables.",
    );
  }
  return url;
}

/**
 * Returns a shared Drizzle client pointed at DATABASE_URL_TEST. Applies
 * migrations once per process. Call at the top of any integration test file
 * (via the `useTestDb()` helper below) — do NOT create your own connection.
 */
export async function getTestDb(): Promise<Db> {
  if (cached) return cached.db;
  const url = getTestUrl();
  await runMigrations(url);
  cached = createDb(url);
  return cached.db;
}

/**
 * Truncates every application table. Leaves the `__drizzle_migrations`
 * bookkeeping table alone so we don't re-migrate between tests.
 */
export async function resetDb(db: Db): Promise<void> {
  // Order matters less with CASCADE, but list children → parents to keep the
  // generated query readable.
  await db.execute(sql`
    TRUNCATE TABLE
      discount_redemptions,
      discount_codes,
      subscription_billings,
      subscriptions,
      order_items,
      orders,
      customers,
      influencers
    RESTART IDENTITY CASCADE
  `);
}

/**
 * Convenience: drop at the top of a describe() block. Handles both the
 * once-per-file migration and the per-test truncate.
 */
export function useTestDb(): { getDb: () => Db } {
  let db: Db;
  beforeAll(async () => {
    db = await getTestDb();
  });
  beforeEach(async () => {
    await resetDb(db);
  });
  return {
    getDb: () => db,
  };
}
