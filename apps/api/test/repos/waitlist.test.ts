import { describe, it, expect } from "bun:test";
import { useTestDb } from "../helpers/db";
import { waitlistSignups } from "../../src/db/schema/waitlist";
import { upsertWaitlist } from "../../src/repos/waitlist";

describe("upsertWaitlist", () => {
  const { getDb } = useTestDb();

  it("inserts a new row with inserted:true", async () => {
    const db = getDb();
    const out = await upsertWaitlist(db, {
      email: "alice@example.com",
      country: "AR",
      source: "unsupported_modal",
      detectedCountry: "AR",
      userAgent: "Mozilla/5.0",
    });
    expect(out.inserted).toBe(true);
    expect(out.id).toBeTruthy();

    const rows = await db.select().from(waitlistSignups);
    expect(rows.length).toBe(1);
    expect(rows[0]?.email).toBe("alice@example.com");
    expect(rows[0]?.country).toBe("AR");
    expect(rows[0]?.userAgent).toBe("Mozilla/5.0");
  });

  it("updates country + source on re-submit and returns inserted:false", async () => {
    const db = getDb();
    const first = await upsertWaitlist(db, {
      email: "bob@example.com",
      country: "AR",
      source: "unsupported_modal",
    });
    const second = await upsertWaitlist(db, {
      email: "bob@example.com",
      country: "BR",
      source: "navbar_selector",
      userAgent: "second-ua",
    });
    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
    expect(second.id).toBe(first.id);

    const rows = await db.select().from(waitlistSignups);
    expect(rows.length).toBe(1);
    expect(rows[0]?.country).toBe("BR");
    expect(rows[0]?.source).toBe("navbar_selector");
    expect(rows[0]?.userAgent).toBe("second-ua");
  });
});
