/**
 * SubscriptionTeaser — smoke import (bun:test, no jsdom).
 */
import { describe, expect, it } from "bun:test";
import { SubscriptionTeaser } from "@/components/home/subscription-teaser";

describe("SubscriptionTeaser", () => {
  it("exports a function component", () => {
    expect(typeof SubscriptionTeaser).toBe("function");
  });
});
