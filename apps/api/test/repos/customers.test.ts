import { describe, it, expect } from "bun:test";
import { useTestDb } from "../helpers/db";
import { upsertCustomerByClerkUserId, getCustomerById } from "../../src/repos/customers";

describe("customers repo", () => {
  const { getDb } = useTestDb();

  describe("upsertCustomerByClerkUserId", () => {
    it("inserts a new customer on first call", async () => {
      const db = getDb();
      const customer = await upsertCustomerByClerkUserId(db, {
        clerkUserId: "user_abc",
        email: "alice@example.com",
      });
      expect(customer.clerkUserId).toBe("user_abc");
      expect(customer.email).toBe("alice@example.com");
      expect(customer.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(customer.createdAt).toBeInstanceOf(Date);
    });

    it("returns the existing customer on subsequent calls with the same clerk_user_id", async () => {
      const db = getDb();
      const first = await upsertCustomerByClerkUserId(db, {
        clerkUserId: "user_bob",
        email: "bob@example.com",
      });
      const second = await upsertCustomerByClerkUserId(db, {
        clerkUserId: "user_bob",
        email: "bob@example.com",
      });
      expect(second.id).toBe(first.id);
    });

    it("updates the email + updatedAt if the email changed in Clerk", async () => {
      const db = getDb();
      const first = await upsertCustomerByClerkUserId(db, {
        clerkUserId: "user_carol",
        email: "carol@example.com",
      });
      // Wall-clock sleep so Postgres NOW() advances beyond the first call.
      // Locks in the "updated_at must advance on upsert" invariant — if
      // someone deletes the explicit `updatedAt: new Date()` in the repo,
      // this test catches the regression.
      await Bun.sleep(2);
      const second = await upsertCustomerByClerkUserId(db, {
        clerkUserId: "user_carol",
        email: "carol.new@example.com",
      });
      expect(second.id).toBe(first.id);
      expect(second.email).toBe("carol.new@example.com");
      expect(second.updatedAt.getTime()).toBeGreaterThan(first.updatedAt.getTime());
    });
  });

  describe("getCustomerById", () => {
    it("returns the customer when present", async () => {
      const db = getDb();
      const inserted = await upsertCustomerByClerkUserId(db, {
        clerkUserId: "user_dan",
        email: "dan@example.com",
      });
      const loaded = await getCustomerById(db, inserted.id);
      expect(loaded?.id).toBe(inserted.id);
      expect(loaded?.email).toBe("dan@example.com");
    });

    it("returns undefined for unknown id", async () => {
      const db = getDb();
      const loaded = await getCustomerById(db, "00000000-0000-0000-0000-000000000000");
      expect(loaded).toBeUndefined();
    });
  });
});
