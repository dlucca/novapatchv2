import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { fetchCustomer, ApiError } from "../../src/lib/api";

const ORIGINAL_FETCH = globalThis.fetch;

describe("fetchCustomer", () => {
  let calls: Array<{ url: string; init: RequestInit | undefined }>;

  beforeEach(() => {
    calls = [];
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
  });

  function stubFetch(response: Response): void {
    globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      calls.push({ url, init });
      return response;
    }) as unknown as typeof fetch;
  }

  it("hits /me/customer on the configured API URL with a bearer token", async () => {
    stubFetch(
      new Response(
        JSON.stringify({
          id: "11111111-1111-1111-1111-111111111111",
          clerkUserId: "user_alice",
          email: "alice@example.com",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const customer = await fetchCustomer({ token: "tok_alice", apiUrl: "http://api.test" });
    expect(customer.email).toBe("alice@example.com");
    expect(customer.id).toBe("11111111-1111-1111-1111-111111111111");
    expect(calls[0]?.url).toBe("http://api.test/me/customer");
    const auth = (calls[0]?.init?.headers as Record<string, string>)?.Authorization;
    expect(auth).toBe("Bearer tok_alice");
  });

  it("throws ApiError with parsed envelope on 401", async () => {
    stubFetch(
      new Response(
        JSON.stringify({
          error: { code: "auth_invalid", message: "token could not be verified" },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );
    try {
      await fetchCustomer({ token: "tok_bad", apiUrl: "http://api.test" });
      throw new Error("expected fetchCustomer to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe("auth_invalid");
      expect((err as ApiError).status).toBe(401);
    }
  });

  it("throws ApiError with code=network when fetch rejects", async () => {
    globalThis.fetch = mock(async () => {
      throw new Error("econnrefused");
    }) as unknown as typeof fetch;
    try {
      await fetchCustomer({ token: "tok_alice", apiUrl: "http://api.test" });
      throw new Error("expected fetchCustomer to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe("network");
    }
  });
});
