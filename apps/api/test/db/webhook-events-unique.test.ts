import { describe, it, expect } from "bun:test";
import { useTestDb } from "../helpers/db";
import { webhookEvents } from "../../src/db/schema/webhook-events";

describe("webhook_events UNIQUE(provider, eventId)", () => {
  const { getDb } = useTestDb();

  it("rejects two events with the same (provider, eventId)", async () => {
    const db = getDb();
    await db.insert(webhookEvents).values({
      provider: "stripe",
      eventId: "evt_dup",
      eventType: "charge.succeeded",
      payload: {},
    });
    await expect(
      Promise.resolve(
        db.insert(webhookEvents).values({
          provider: "stripe",
          eventId: "evt_dup",
          eventType: "charge.succeeded",
          payload: {},
        }),
      ),
    ).rejects.toThrow(/webhook_events_provider_event_unique/);
  });

  it("allows the same eventId across different providers", async () => {
    const db = getDb();
    await db.insert(webhookEvents).values({
      provider: "stripe",
      eventId: "evt_shared",
      eventType: "charge.succeeded",
      payload: {},
    });
    await db.insert(webhookEvents).values({
      provider: "mercadopago",
      eventId: "evt_shared",
      eventType: "charge.succeeded",
      payload: {},
    });
    const rows = await db.select().from(webhookEvents);
    expect(rows.length).toBe(2);
  });
});
