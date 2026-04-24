#!/usr/bin/env bun
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { readEnv } from "../env";

/**
 * Applies all pending migrations from apps/api/drizzle/ against the given URL
 * (or DATABASE_URL from env). Invoked by `pnpm db:migrate` and by the test helper.
 */
export async function runMigrations(connectionString?: string): Promise<void> {
  const env = readEnv();
  const url = connectionString ?? env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required to run migrations");
  }
  const client = postgres(url, { max: 1 });
  try {
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: `${import.meta.dir}/../../drizzle` });
  } finally {
    await client.end();
  }
}

// Run when executed directly (e.g. `bun run src/db/migrate.ts` or `pnpm db:migrate`).
if (import.meta.main) {
  await runMigrations();
  console.log("migrations applied");
}
