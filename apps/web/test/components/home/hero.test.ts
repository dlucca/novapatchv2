/**
 * Hero — smoke import + cart store integration tests (bun:test, no jsdom).
 *
 * Covers:
 *  - Hero exports a function component (smoke import).
 *  - The default selected index (2 = Glow) maps to a product whose addItem
 *    flow lands {slug:"glow", price:750, qty:1} in the cart store and opens
 *    the drawer (mirrors the primary CTA logic).
 *  - Auto-rotation index math wraps over NOVA_PRODUCTS.length.
 */
import { beforeEach, describe, expect, it } from "bun:test";
import { Hero } from "@/components/home/hero";
import { NOVA_PRODUCTS, RETAIL_PRICE } from "@/lib/products";
import { useCart } from "@/components/cart/cart-store";

const localStore: Record<string, string> = {};
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => localStore[k] ?? null,
    setItem: (k: string, v: string) => {
      localStore[k] = v;
    },
    removeItem: (k: string) => {
      delete localStore[k];
    },
    clear: () => {
      for (const k of Object.keys(localStore)) delete localStore[k];
    },
  },
  writable: true,
  configurable: true,
});

beforeEach(() => {
  localStorage.clear();
  useCart.setState({ items: [], drawerOpen: false, hydrated: true });
});

describe("Hero", () => {
  it("exports a function component", () => {
    expect(typeof Hero).toBe("function");
  });

  it("default selected index (2) is Glow", () => {
    expect(NOVA_PRODUCTS[2]?.slug).toBe("glow");
  });

  it("primary CTA logic adds the selected product at retail price and opens drawer", () => {
    const product = NOVA_PRODUCTS[2]!;
    useCart.getState().addItem(product, RETAIL_PRICE);
    useCart.getState().openDrawer();

    const { items, drawerOpen } = useCart.getState();
    expect(items[0]).toMatchObject({ slug: "glow", price: 750, qty: 1 });
    expect(drawerOpen).toBe(true);
  });

  it("auto-rotation index math wraps modulo product count", () => {
    const len = NOVA_PRODUCTS.length;
    expect(len).toBe(6);
    let s = 2;
    for (let i = 0; i < len; i++) s = (s + 1) % len;
    expect(s).toBe(2); // full loop returns to start
    expect(((len - 1) + 1) % len).toBe(0);
  });

  it("RETAIL_PRICE is 750", () => {
    expect(RETAIL_PRICE).toBe(750);
  });
});
