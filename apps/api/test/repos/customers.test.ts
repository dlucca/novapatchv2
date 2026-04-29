import { describe, it, expect } from "bun:test";
import { useTestDb } from "../helpers/db";
import {
  upsertCustomerByClerkUserId,
  getCustomerById,
  setGatewayCredentials,
} from "../../src/repos/customers";

describe("customers repo", () => {
  const { getDb } = useTestDb();

  describe("upsertCustomerByClerkUserId", () => {
    it("inserts a new customer on first call", async () => {
      const db = getDb();
      const customer = await upsertCustomerByClerkUserId(db, {
        clerkUserId: "user_abc",
        email: "alice@example.com",
        market: "mx",
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
        market: "mx",
      });
      const second = await upsertCustomerByClerkUserId(db, {
        clerkUserId: "user_bob",
        email: "bob@example.com",
        market: "mx",
      });
      expect(second.id).toBe(first.id);
    });

    it("updates the email + updatedAt if the email changed in Clerk", async () => {
      const db = getDb();
      const first = await upsertCustomerByClerkUserId(db, {
        clerkUserId: "user_carol",
        email: "carol@example.com",
        market: "mx",
      });
      // Wall-clock sleep so Postgres NOW() advances beyond the first call.
      // Locks in the "updated_at must advance on upsert" invariant — if
      // someone deletes the explicit `updatedAt: new Date()` in the repo,
      // this test catches the regression. 10ms is generous — Postgres has µs
      // resolution but OS clock jitter + test runner scheduling means 2ms
      // sometimes lands in the same millisecond.
      await Bun.sleep(10);
      const second = await upsertCustomerByClerkUserId(db, {
        clerkUserId: "user_carol",
        email: "carol.new@example.com",
        market: "mx",
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
        market: "mx",
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

  describe("upsertCustomerByClerkUserId — country handling", () => {
    it("sets country from market on insert (non-default market)", async () => {
      const db = getDb();
      const c = await upsertCustomerByClerkUserId(db, {
        clerkUserId: "u_country_ar",
        email: "ar@example.com",
        market: "ar",
      });
      expect(c.country).toBe("ar");
    });

    it("does not overwrite country on subsequent upserts", async () => {
      const db = getDb();
      const first = await upsertCustomerByClerkUserId(db, {
        clerkUserId: "u_country_keep",
        email: "k@example.com",
        market: "mx",
      });
      expect(first.country).toBe("mx");
      const second = await upsertCustomerByClerkUserId(db, {
        clerkUserId: "u_country_keep",
        email: "k@example.com",
        market: "ar",
      });
      expect(second.country).toBe("mx");
    });

    it("updates email on conflict", async () => {
      const db = getDb();
      await upsertCustomerByClerkUserId(db, {
        clerkUserId: "u_email",
        email: "old@example.com",
        market: "mx",
      });
      const updated = await upsertCustomerByClerkUserId(db, {
        clerkUserId: "u_email",
        email: "new@example.com",
        market: "mx",
      });
      expect(updated.email).toBe("new@example.com");
    });
  });

  describe("setGatewayCredentials", () => {
    it("stamps gatewayCustomerIds[gateway], defaultCardId, recurringConsentAt", async () => {
      const db = getDb();
      const customer = await upsertCustomerByClerkUserId(db, {
        clerkUserId: "u_creds",
        email: "creds@example.com",
        market: "mx",
      });
      const consentAt = new Date("2026-05-01T12:00:00Z");
      await setGatewayCredentials(db, {
        customerId: customer.id,
        gatewayName: "stripe",
        gatewayCustomerId: "cus_AAA",
        paymentMethodId: "pm_AAA",
        consentAt,
      });
      const fetched = await getCustomerById(db, customer.id);
      expect(fetched?.gatewayCustomerIds).toMatchObject({ stripe: "cus_AAA" });
      expect(fetched?.defaultCardId).toBe("pm_AAA");
      expect(fetched?.recurringConsentAt?.getTime()).toBe(consentAt.getTime());
    });

    it("merges into existing gatewayCustomerIds without dropping other gateways", async () => {
      const db = getDb();
      const customer = await upsertCustomerByClerkUserId(db, {
        clerkUserId: "u_merge",
        email: "merge@example.com",
        market: "mx",
      });
      await setGatewayCredentials(db, {
        customerId: customer.id,
        gatewayName: "mercadopago",
        gatewayCustomerId: "mp_OLD",
        paymentMethodId: "card_OLD",
        consentAt: new Date(),
      });
      await setGatewayCredentials(db, {
        customerId: customer.id,
        gatewayName: "stripe",
        gatewayCustomerId: "cus_NEW",
        paymentMethodId: "pm_NEW",
        consentAt: new Date(),
      });
      const fetched = await getCustomerById(db, customer.id);
      expect(fetched?.gatewayCustomerIds).toMatchObject({
        mercadopago: "mp_OLD",
        stripe: "cus_NEW",
      });
      expect(fetched?.defaultCardId).toBe("pm_NEW"); // most-recent wins
    });

    it("throws when customer doesn't exist", async () => {
      const db = getDb();
      await expect(
        setGatewayCredentials(db, {
          customerId: "00000000-0000-0000-0000-000000000000",
          gatewayName: "stripe",
          gatewayCustomerId: "cus_X",
          paymentMethodId: "pm_X",
          consentAt: new Date(),
        }),
      ).rejects.toThrow(/not found/);
    });
  });
});
