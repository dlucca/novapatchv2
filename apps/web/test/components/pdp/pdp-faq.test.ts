import { describe, expect, it } from "bun:test";
import { PdpFaq } from "@/components/pdp/pdp-faq";

describe("PdpFaq", () => {
  it("exports a function", () => {
    expect(typeof PdpFaq).toBe("function");
  });
});
