/**
 * PlanBuilder — smoke import + cart-store interaction tests.
 *
 * No DOM in bun:test, so we don't render. We:
 *   1. Smoke-import PlanBuilder.
 *   2. Drive useCart.addItem with subscription metadata to assert dedupe rules.
 */
import { beforeEach, describe, expect, it } from "bun:test";
import { useCart } from "@/components/cart/cart-store";
import { PlanBuilder } from "@/components/plan/plan-builder";
import type { ProductMeta } from "@/lib/products";

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const k of Object.keys(store)) delete store[k];
  },
};
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

const energy: ProductMeta = {
  slug: "energy",
  name: "Energy",
  image: "/products/Energy.webp",
  tagline: "t",
  quote: "q",
  color: "#83B5F4",
  ink: "#1A5C9A",
  bg: "#EBF4FB",
  ingredients: [],
  tags: [],
};

beforeEach(() => {
  localStorage.clear();
  useCart.setState({ items: [], drawerOpen: false });
});

describe("PlanBuilder module", () => {
  it("exports a function component", () => {
    expect(typeof PlanBuilder).toBe("function");
  });
});

describe("PlanBuilder → cart-store integration", () => {
  it("addItem with subscription metadata creates a line with subscription set", () => {
    useCart
      .getState()
      .addItem(energy, 638, { interval_days: 30, discount_percentage: 15 });
    const items = useCart.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]?.subscription).toEqual({
      interval_days: 30,
      discount_percentage: 15,
    });
    expect(items[0]?.qty).toBe(1);
    expect(items[0]?.price).toBe(638);
  });

  it("same slug + same freq bumps qty (single line)", () => {
    useCart
      .getState()
      .addItem(energy, 638, { interval_days: 30, discount_percentage: 15 });
    useCart
      .getState()
      .addItem(energy, 638, { interval_days: 30, discount_percentage: 15 });
    const items = useCart.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]?.qty).toBe(2);
  });

  it("same slug + different freq creates a new line", () => {
    useCart
      .getState()
      .addItem(energy, 638, { interval_days: 30, discount_percentage: 15 });
    useCart
      .getState()
      .addItem(energy, 675, { interval_days: 60, discount_percentage: 10 });
    const items = useCart.getState().items;
    expect(items).toHaveLength(2);
    expect(items[0]?.subscription?.interval_days).toBe(30);
    expect(items[1]?.subscription?.interval_days).toBe(60);
  });

  it("subscription line and one-time line for same slug stay separate", () => {
    useCart.getState().addItem(energy, 750); // one-time
    useCart
      .getState()
      .addItem(energy, 638, { interval_days: 30, discount_percentage: 15 });
    const items = useCart.getState().items;
    expect(items).toHaveLength(2);
    expect(items[0]?.subscription).toBeUndefined();
    expect(items[1]?.subscription).toBeDefined();
  });
});
