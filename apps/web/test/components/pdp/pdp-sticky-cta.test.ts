import { describe, expect, it } from "bun:test";
import { PdpStickyCta } from "@/components/pdp/pdp-sticky-cta";

describe("PdpStickyCta", () => {
  it("exports a function", () => {
    expect(typeof PdpStickyCta).toBe("function");
  });
});
