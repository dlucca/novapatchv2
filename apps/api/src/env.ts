import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(9000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

export function readEnv(source: Record<string, string | undefined> = process.env): Env {
  return envSchema.parse(source);
}
