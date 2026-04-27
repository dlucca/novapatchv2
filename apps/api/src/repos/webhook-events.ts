import { and, asc, eq, isNull } from "drizzle-orm";
import type { Db } from "../db";
import {
  webhookEvents,
  type WebhookEvent,
} from "../db/schema/webhook-events";

export type WebhookProvider = "stripe" | "mercadopago";

export interface RecordEventInput {
  provider: WebhookProvider;
  eventId: string;
  eventType: string;
  payload: unknown;
}

export interface RecordEventOutput {
  id: string;
  inserted: boolean;
}

/**
 * Idempotent insert keyed by (provider, eventId). Returns inserted:false
 * when the event is a duplicate — caller should skip processing in that case.
 */
export async function recordEvent(
  db: Db,
  input: RecordEventInput,
): Promise<RecordEventOutput> {
  const inserted = await db
    .insert(webhookEvents)
    .values({
      provider: input.provider,
      eventId: input.eventId,
      eventType: input.eventType,
      payload: input.payload,
    })
    .onConflictDoNothing({
      target: [webhookEvents.provider, webhookEvents.eventId],
    })
    .returning({ id: webhookEvents.id });

  if (inserted[0]) {
    return { id: inserted[0].id, inserted: true };
  }

  const [existing] = await db
    .select({ id: webhookEvents.id })
    .from(webhookEvents)
    .where(
      and(
        eq(webhookEvents.provider, input.provider),
        eq(webhookEvents.eventId, input.eventId),
      ),
    )
    .limit(1);
  if (!existing) {
    throw new Error("recordEvent: conflict path could not find existing row");
  }
  return { id: existing.id, inserted: false };
}

export async function markProcessed(db: Db, id: string): Promise<void> {
  await db
    .update(webhookEvents)
    .set({ processedAt: new Date() })
    .where(eq(webhookEvents.id, id));
}

export interface FindUnprocessedInput {
  provider?: WebhookProvider;
  limit: number;
}

export async function findUnprocessed(
  db: Db,
  input: FindUnprocessedInput,
): Promise<WebhookEvent[]> {
  const where = input.provider
    ? and(isNull(webhookEvents.processedAt), eq(webhookEvents.provider, input.provider))
    : isNull(webhookEvents.processedAt);

  return await db
    .select()
    .from(webhookEvents)
    .where(where)
    .orderBy(asc(webhookEvents.receivedAt))
    .limit(input.limit);
}
