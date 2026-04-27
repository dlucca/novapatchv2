import { describe, expect, it } from "bun:test";
import {
  perBox,
  monthlyOf,
  fullMonthlyOf,
  monthly,
  saved,
  discountPercent,
} from "@/lib/plan-pricing";

// RETAIL_PRICE = 750. Discounts: 30→20%, 60→15%, 90→10%.

describe("plan-pricing", () => {
  describe("perBox", () => {
    it("30d → 20% off → round(750*0.8) = 600", () => {
      expect(perBox(30)).toBe(600);
    });
    it("60d → 15% off → round(750*0.85) = 638", () => {
      expect(perBox(60)).toBe(638); // 637.5 rounded → 638
    });
    it("90d → 10% off → round(750*0.9) = 675", () => {
      expect(perBox(90)).toBe(675);
    });
  });

  describe("discountPercent", () => {
    it("returns 20 / 15 / 10", () => {
      expect(discountPercent(30)).toBe(20);
      expect(discountPercent(60)).toBe(15);
      expect(discountPercent(90)).toBe(10);
    });
  });

  describe("monthlyOf / fullMonthlyOf", () => {
    it("30d monthly = 600 (one box per month)", () => {
      expect(monthlyOf(30)).toBeCloseTo(600, 5);
      expect(fullMonthlyOf(30)).toBeCloseTo(750, 5);
    });
    it("60d monthly = 750*0.85/2 = 318.75", () => {
      expect(monthlyOf(60)).toBeCloseTo(318.75, 5);
      expect(fullMonthlyOf(60)).toBeCloseTo(375, 5);
    });
    it("90d monthly = 750*0.9/3 = 225", () => {
      expect(monthlyOf(90)).toBeCloseTo(225, 5);
      expect(fullMonthlyOf(90)).toBeCloseTo(250, 5);
    });
  });

  describe("monthly / saved (sums)", () => {
    it("single 30d item → 600 monthly, saved = 150", () => {
      const items = [{ slug: "energy", freq: 30 as const }];
      expect(monthly(items)).toBeCloseTo(600, 5);
      expect(saved(items)).toBeCloseTo(150, 5);
    });

    it("single 90d item → 225 monthly, saved = 25", () => {
      const items = [{ slug: "energy", freq: 90 as const }];
      expect(monthly(items)).toBeCloseTo(225, 5);
      expect(saved(items)).toBeCloseTo(25, 5);
    });

    it("mixed 30+60+90 → sums correctly", () => {
      const items = [
        { slug: "energy", freq: 30 as const },
        { slug: "sleep", freq: 60 as const },
        { slug: "glow", freq: 90 as const },
      ];
      // 600 + 318.75 + 225 = 1143.75
      expect(monthly(items)).toBeCloseTo(1143.75, 5);
      // full = 750 + 375 + 250 = 1375  → saved = 231.25
      expect(saved(items)).toBeCloseTo(231.25, 5);
    });

    it("empty list → 0 monthly, 0 saved", () => {
      expect(monthly([])).toBe(0);
      expect(saved([])).toBe(0);
    });
  });
});
