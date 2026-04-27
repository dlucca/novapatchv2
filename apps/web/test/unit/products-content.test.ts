import { describe, expect, it } from "bun:test";
import { getProductContent, PRODUCTS_CONTENT } from "@/lib/products-content";

describe("products-content", () => {
  it("getProductContent returns undefined for unknown slug", () => {
    expect(getProductContent("not-a-slug")).toBeUndefined();
    expect(getProductContent("")).toBeUndefined();
  });

  it("PRODUCTS_CONTENT is a record (will be populated in Tasks 2/3)", () => {
    expect(typeof PRODUCTS_CONTENT).toBe("object");
  });
});
