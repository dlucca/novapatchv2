/**
 * FinalCTA — smoke import (bun:test, no jsdom).
 */
import { describe, expect, it } from "bun:test";
import { FinalCTA } from "@/components/home/final-cta";

describe("FinalCTA", () => {
  it("exports a function component", () => {
    expect(typeof FinalCTA).toBe("function");
  });
});
