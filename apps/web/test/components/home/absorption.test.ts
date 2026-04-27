/**
 * Absorption — smoke import (bun:test, no jsdom).
 */
import { describe, expect, it } from "bun:test";
import { Absorption } from "@/components/home/absorption";

describe("Absorption", () => {
  it("exports a function component", () => {
    expect(typeof Absorption).toBe("function");
  });
});
