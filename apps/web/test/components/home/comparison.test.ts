/**
 * Comparison — smoke import (bun:test, no jsdom).
 */
import { describe, expect, it } from "bun:test";
import { Comparison } from "@/components/home/comparison";

describe("Comparison", () => {
  it("exports a function component", () => {
    expect(typeof Comparison).toBe("function");
  });
});
