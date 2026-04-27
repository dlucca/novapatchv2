import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../db";
import { upsertWaitlist } from "../repos/waitlist";
import { apiError } from "../lib/errors";

const BodySchema = z.object({
  email: z.string().email().toLowerCase().max(255),
  country: z.string().length(2).toUpperCase(),
  source: z.enum(["unsupported_modal", "navbar_selector"]),
  detectedCountry: z.string().length(2).toUpperCase().optional(),
});

export interface WaitlistDeps {
  db: Db;
}

export function createWaitlistRoutes(deps: WaitlistDeps): Hono {
  const r = new Hono();

  r.post("/", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      const { body, status } = apiError(
        "invalid_input",
        parsed.error.issues[0]?.message ?? "invalid request body",
        400,
      );
      return c.json(body, status);
    }

    const userAgent = (c.req.header("user-agent") ?? "").slice(0, 500) || undefined;
    const result = await upsertWaitlist(deps.db, {
      email: parsed.data.email,
      country: parsed.data.country,
      source: parsed.data.source,
      ...(parsed.data.detectedCountry ? { detectedCountry: parsed.data.detectedCountry } : {}),
      ...(userAgent ? { userAgent } : {}),
    });

    return c.json({ ok: true, inserted: result.inserted });
  });

  return r;
}
