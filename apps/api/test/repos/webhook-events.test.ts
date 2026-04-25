import { describe, it, expect } from "bun:test";
import { useTestDb } from "../helpers/db";
import { webhookEvents } from "../../src/db/schema/webhook-events";
import {
  recordEvent,
  markProcessed,
  findUnprocessed,
} from "../../src/repos/webhook-events";

describe("recordEvent", () => {
  const { getDb } = useTestDb();

  it("inserts a new event with inserted:true", async () => {
    const db = getDb();
    const result = await recordEvent(db, {
      provider: "stripe",
      eventId: "evt_1",
      eventType: "charge.succeeded",
      payload: { id: "evt_1" },
    });
    expect(result.inserted).toBe(true);
    expect(result.id).toBeTruthy();
  });

  it("returns inserted:false for duplicate (provider, eventId) and does not insert", async () => {
    const db = getDb();
    const first = await recordEvent(db, {
      provider: "stripe",
      eventId: "evt_dup",
      eventType: "charge.succeeded",
      payload: {},
    });
    const second = await recordEvent(db, {
      provider: "stripe",
      eventId: "evt_dup",
      eventType: "charge.succeeded",
      payload: {},
    });
    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
    expect(second.id).toBe(first.id);
    const rows = await db.select().from(webhookEvents);
    expect(rows.length).toBe(1);
  });
});

describe("markProcessed", () => {
  const { getDb } = useTestDb();

  it("sets processedAt to a non-null timestamp", async () => {
    const db = getDb();
    const r = await recordEvent(db, {
      provider: "stripe",
      eventId: "evt_mp",
      eventType: "charge.failed",
      payload: {},
    });
    await markProcessed(db, r.id);
    const [row] = await db.select().from(webhookEvents);
    expect(row?.processedAt).toBeTruthy();
  });
});

describe("findUnprocessed", () => {
  const { getDb } = useTestDb();

  it("returns only events with processedAt IS NULL", async () => {
    const db = getDb();
    const a = await recordEvent(db, {
      provider: "stripe",
      eventId: "evt_a",
      eventType: "charge.succeeded",
      payload: {},
    });
    await recordEvent(db, {
      provider: "stripe",
      eventId: "evt_b",
      eventType: "charge.succeeded",
      payload: {},
    });
    await markProcessed(db, a.id);
    const unprocessed = await findUnprocessed(db, { limit: 50 });
    expect(unprocessed).toHaveLength(1);
    expect(unprocessed[0]?.eventId).toBe("evt_b");
  });

  it("filters by provider when provided", async () => {
    const db = getDb();
    await recordEvent(db, {
      provider: "stripe",
      eventId: "evt_s",
      eventType: "charge.succeeded",
      payload: {},
    });
    await recordEvent(db, {
      provider: "mercadopago",
      eventId: "evt_m",
      eventType: "payment.created",
      payload: {},
    });
    const stripeOnly = await findUnprocessed(db, { provider: "stripe", limit: 50 });
    expect(stripeOnly).toHaveLength(1);
    expect(stripeOnly[0]?.provider).toBe("stripe");
  });
});
