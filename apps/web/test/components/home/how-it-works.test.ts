/**
 * HowItWorks — smoke import (bun:test, no jsdom).
 */
import { describe, expect, it } from "bun:test";
import { HowItWorks } from "@/components/home/how-it-works";

describe("HowItWorks", () => {
  it("exports a function component", () => {
    expect(typeof HowItWorks).toBe("function");
  });
});
