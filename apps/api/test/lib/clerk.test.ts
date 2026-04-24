import { describe, it, expect } from "bun:test";
import {
  createStubVerifier,
  createStubUserClient,
} from "../../src/lib/clerk";

describe("createStubVerifier", () => {
  it("returns the configured payload for a known token", async () => {
    const verifier = createStubVerifier({
      "tok_alice": { clerkUserId: "user_alice" },
    });
    const result = await verifier.verify("tok_alice");
    expect(result.clerkUserId).toBe("user_alice");
  });

  it("throws for an unknown token", async () => {
    const verifier = createStubVerifier({});
    await expect(verifier.verify("tok_missing")).rejects.toThrow(/invalid|unknown/i);
  });
});

describe("createStubUserClient", () => {
  it("returns the configured user for a known id", async () => {
    const client = createStubUserClient({
      "user_alice": { clerkUserId: "user_alice", email: "alice@example.com" },
    });
    const user = await client.getUser("user_alice");
    expect(user.email).toBe("alice@example.com");
  });

  it("throws for an unknown user id", async () => {
    const client = createStubUserClient({});
    await expect(client.getUser("user_missing")).rejects.toThrow(/not found|unknown/i);
  });
});
