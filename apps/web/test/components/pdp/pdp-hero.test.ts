import { describe, expect, it } from "bun:test";
import { PdpHero } from "@/components/pdp/pdp-hero";

describe("PdpHero", () => {
  it("exports a function", () => {
    expect(typeof PdpHero).toBe("function");
  });
});
