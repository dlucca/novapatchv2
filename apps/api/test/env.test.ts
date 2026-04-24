import { describe, it, expect } from "bun:test";
import { readEnv } from "../src/env";

describe("readEnv", () => {
  it("accepts the minimum required vars and returns defaults", () => {
    const env = readEnv({});
    expect(env.PORT).toBe(9000);
    expect(env.NODE_ENV).toBe("development");
    expect(env.CORS_ORIGINS).toEqual(["http://localhost:3000"]);
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.CLERK_SECRET_KEY).toBeUndefined();
  });

  it("parses CORS_ORIGINS from a comma-separated list and trims", () => {
    const env = readEnv({ CORS_ORIGINS: " https://novapatch.com , https://staging.novapatch.com " });
    expect(env.CORS_ORIGINS).toEqual([
      "https://novapatch.com",
      "https://staging.novapatch.com",
    ]);
  });

  it("accepts DATABASE_URL, CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY as optional strings", () => {
    const env = readEnv({
      DATABASE_URL: "postgres://user:pass@host:5432/db",
      CLERK_SECRET_KEY: "sk_test_123",
      CLERK_PUBLISHABLE_KEY: "pk_test_123",
    });
    expect(env.DATABASE_URL).toBe("postgres://user:pass@host:5432/db");
    expect(env.CLERK_SECRET_KEY).toBe("sk_test_123");
    expect(env.CLERK_PUBLISHABLE_KEY).toBe("pk_test_123");
  });

  it("accepts payment provider keys", () => {
    const env = readEnv({
      OPENPAY_MERCHANT_ID: "mid",
      OPENPAY_PRIVATE_KEY: "sk_123",
      OPENPAY_PUBLIC_KEY: "pk_123",
      MERCADOPAGO_ACCESS_TOKEN: "TEST-abc",
    });
    expect(env.OPENPAY_MERCHANT_ID).toBe("mid");
    expect(env.OPENPAY_PRIVATE_KEY).toBe("sk_123");
    expect(env.OPENPAY_PUBLIC_KEY).toBe("pk_123");
    expect(env.MERCADOPAGO_ACCESS_TOKEN).toBe("TEST-abc");
  });

  it("rejects negative PORT", () => {
    expect(() => readEnv({ PORT: "-1" })).toThrow();
  });

  it("rejects NODE_ENV outside the enum", () => {
    expect(() => readEnv({ NODE_ENV: "staging" })).toThrow();
  });
});
