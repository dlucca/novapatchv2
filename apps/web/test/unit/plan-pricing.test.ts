import { describe, expect, it } from "bun:test";
import {
  perBox,
  monthlyOf,
  fullMonthlyOf,
  monthly,
  saved,
  discountPercent,
} from "@/lib/plan-pricing";

// RETAIL_PRICE = 750. Discounts: 30→15%, 60→10%, 90→5%.

describe("plan-pricing", () => {
  describe("perBox", () => {
    it("30d → 15% off → round(750*0.85) = 638", () => {
      expect(perBox(30)).toBe(638);
    });
    it("60d → 10% off → round(750*0.9) = 675", () => {
      expect(perBox(60)).toBe(675);
    });
    it("90d → 5% off → round(750*0.95) = 713", () => {
      expect(perBox(90)).toBe(713);
    });
  });

  describe("discountPercent", () => {
    it("returns 15 / 10 / 5", () => {
      expect(discountPercent(30)).toBe(15);
      expect(discountPercent(60)).toBe(10);
      expect(discountPercent(90)).toBe(5);
    });
  });

  describe("monthlyOf / fullMonthlyOf", () => {
    it("30d monthly = 637.5 (one box per month)", () => {
      expect(monthlyOf(30)).toBeCloseTo(637.5, 5);
      expect(fullMonthlyOf(30)).toBeCloseTo(750, 5);
    });
    it("60d monthly = 750*0.9/2 = 337.5", () => {
      expect(monthlyOf(60)).toBeCloseTo(337.5, 5);
      expect(fullMonthlyOf(60)).toBeCloseTo(375, 5);
    });
    it("90d monthly = 750*0.95/3 = 237.5", () => {
      expect(monthlyOf(90)).toBeCloseTo(237.5, 5);
      expect(fullMonthlyOf(90)).toBeCloseTo(250, 5);
    });
  });

  describe("monthly / saved (sums)", () => {
    it("single 30d item → 637.5 monthly, saved = 112.5", () => {
      const items = [{ slug: "energy", freq: 30 as const }];
      expect(monthly(items)).toBeCloseTo(637.5, 5);
      expect(saved(items)).toBeCloseTo(112.5, 5);
    });

    it("single 90d item → 237.5 monthly, saved = 12.5", () => {
      const items = [{ slug: "energy", freq: 90 as const }];
      expect(monthly(items)).toBeCloseTo(237.5, 5);
      expect(saved(items)).toBeCloseTo(12.5, 5);
    });

    it("mixed 30+60+90 → sums correctly", () => {
      const items = [
        { slug: "energy", freq: 30 as const },
        { slug: "sleep", freq: 60 as const },
        { slug: "glow", freq: 90 as const },
      ];
      // 637.5 + 337.5 + 237.5 = 1212.5
      expect(monthly(items)).toBeCloseTo(1212.5, 5);
      // full = 750 + 375 + 250 = 1375  -> saved = 162.5
      expect(saved(items)).toBeCloseTo(162.5, 5);
    });

    it("empty list → 0 monthly, 0 saved", () => {
      expect(monthly([])).toBe(0);
      expect(saved([])).toBe(0);
    });
  });
});
