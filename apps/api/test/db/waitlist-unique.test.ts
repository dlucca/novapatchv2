import { describe, it, expect } from "bun:test";
import { useTestDb } from "../helpers/db";
import { waitlistSignups } from "../../src/db/schema/waitlist";

describe("waitlist_signups UNIQUE(email)", () => {
  const { getDb } = useTestDb();

  it("rejects two inserts with the same email", async () => {
    const db = getDb();
    await db.insert(waitlistSignups).values({
      email: "dup@example.com",
      country: "AR",
      source: "unsupported_modal",
    });
    // Drizzle insert builders are thenables, not native Promises.
    await expect(
      Promise.resolve(
        db.insert(waitlistSignups).values({
          email: "dup@example.com",
          country: "BR",
          source: "unsupported_modal",
        }),
      ),
    ).rejects.toThrow(/waitlist_signups_email_unique/);
  });

  it("allows distinct emails in the same country", async () => {
    const db = getDb();
    await db.insert(waitlistSignups).values({
      email: "a@example.com",
      country: "AR",
      source: "unsupported_modal",
    });
    await db.insert(waitlistSignups).values({
      email: "b@example.com",
      country: "AR",
      source: "unsupported_modal",
    });
    const rows = await db.select().from(waitlistSignups);
    expect(rows.length).toBe(2);
  });
});
