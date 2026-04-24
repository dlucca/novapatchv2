import { describe, it, expect } from "bun:test";
import { apiError, type ApiErrorCode } from "../../src/lib/errors";

describe("apiError", () => {
  it("returns the expected envelope with status code", () => {
    const { body, status } = apiError("market_missing", "missing ?market query parameter", 400);
    expect(status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "market_missing",
        message: "missing ?market query parameter",
      },
    });
  });

  it("preserves numeric status codes as-is", () => {
    const { status: s404 } = apiError("product_not_found", "x", 404);
    const { status: s500 } = apiError("internal_error", "x", 500);
    expect(s404).toBe(404);
    expect(s500).toBe(500);
  });

  it("accepts all documented codes", () => {
    const codes: ApiErrorCode[] = [
      "market_missing",
      "market_empty",
      "market_unknown",
      "product_not_found",
      "not_found",
      "internal_error",
      "validation_failed",
    ];
    for (const code of codes) {
      const { body } = apiError(code, "msg", 400);
      expect(body.error.code).toBe(code);
    }
  });
});
