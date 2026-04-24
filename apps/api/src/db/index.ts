import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

/**
 * Build a Drizzle client from a connection string. Shared by the runtime app,
 * scripts, and the test helper. Caller is responsible for calling
 * `client.end()` on shutdown (tests typically don't bother — process exit
 * closes it).
 */
export function createDb(connectionString: string): { db: Db; client: ReturnType<typeof postgres> } {
  const client = postgres(connectionString, {
    // Reasonable pool for a Bun-based single-process API.
    max: 10,
    // Keep types simple — we decode timestamps to Date everywhere.
    onnotice: () => {},
  });
  const db = drizzle(client, { schema });
  return { db, client };
}

export { schema };
