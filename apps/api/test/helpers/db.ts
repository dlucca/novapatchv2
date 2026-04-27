import { beforeAll, beforeEach } from "bun:test";
import { sql } from "drizzle-orm";
import { createDb, type Db } from "../../src/db";
import { runMigrations } from "../../src/db/migrate";
import { readEnv } from "../../src/env";

type CachedClient = { db: Db; client: ReturnType<typeof import("postgres")> };

// Promise-cached so concurrent first-call `getTestDb()` invocations from
// parallel beforeAll hooks don't race two migrators against the same DB.
let cachedPromise: Promise<CachedClient> | undefined;

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
 * migrations once per process (guarded by a promise cache so parallel callers
 * don't race). Call via `useTestDb()` below — do NOT create your own client.
 */
export async function getTestDb(): Promise<Db> {
  if (!cachedPromise) {
    cachedPromise = (async () => {
      const url = getTestUrl();
      await runMigrations(url);
      return createDb(url);
    })();
  }
  return (await cachedPromise).db;
}

/**
 * Truncates every application table. Leaves the `__drizzle_migrations`
 * bookkeeping table alone so we don't re-migrate between tests.
 *
 * NOTE: keep the table list in sync with apps/api/src/db/schema/*.ts when
 * adding tables.
 */
export async function resetDb(db: Db): Promise<void> {
  // Order matters less with CASCADE, but list children → parents to keep the
  // generated query readable.
  await db.execute(sql`
    TRUNCATE TABLE
      payment_attempts,
      subscription_runs,
      webhook_events,
      discount_redemptions,
      discount_codes,
      subscriptions,
      order_items,
      orders,
      customers,
      influencers
    RESTART IDENTITY CASCADE
  `);
}

/**
 * Convenience: drop at the top of a `describe()` block. Handles both the
 * once-per-process migration and the per-test truncate.
 *
 * IMPORTANT: integration test files MUST NOT run in parallel against the
 * same DATABASE_URL_TEST. `resetDb()` in one file will truncate rows a
 * concurrent file just inserted. Run with `bun test --concurrency=1` if
 * you ever enable parallel file execution.
 *
 * Usage:
 *
 *     const { getDb } = useTestDb();
 *     it("does a thing", async () => {
 *       const db = getDb();
 *       // ...
 *     });
 */
export function useTestDb(): { getDb: () => Db } {
  let db: Db | undefined;
  beforeAll(async () => {
    db = await getTestDb();
  });
  beforeEach(async () => {
    if (!db) throw new Error("useTestDb(): beforeAll did not run");
    await resetDb(db);
  });
  return {
    getDb: () => {
      if (!db) {
        throw new Error(
          "useTestDb(): getDb() called before beforeAll ran. Call inside it()/beforeEach(), not in the describe() body.",
        );
      }
      return db;
    },
  };
}
