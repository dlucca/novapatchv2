/**
 * ProductGrid — smoke import + cart store integration tests (bun:test, no jsdom).
 *
 * Covers:
 *  - ProductGrid exports a function component (smoke import).
 *  - NOVA_PRODUCTS render in canonical order (energy, sleep, glow, shield, zen, woman).
 *  - "Popular" flag is present only on Glow.
 *  - Add-to-bag flow on Energy lands {slug:"energy", price:750, qty:1} and
 *    opens the drawer (mirrors the per-card button click logic).
 */
import { beforeEach, describe, expect, it } from "bun:test";
import { ProductGrid } from "@/components/home/product-grid";
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

describe("ProductGrid", () => {
  it("exports a function component", () => {
    expect(typeof ProductGrid).toBe("function");
  });

  it("NOVA_PRODUCTS appear in canonical order", () => {
    expect(NOVA_PRODUCTS.map((p) => p.slug)).toEqual([
      "energy",
      "sleep",
      "glow",
      "shield",
      "zen",
      "woman",
    ]);
  });

  it("Popular flag is present only on Glow", () => {
    const popular = NOVA_PRODUCTS.filter((p) => p.popular);
    expect(popular).toHaveLength(1);
    expect(popular[0]?.slug).toBe("glow");
  });

  it("per-card add-to-bag logic adds the product at retail price and opens drawer", () => {
    const energy = NOVA_PRODUCTS[0]!;
    expect(energy.slug).toBe("energy");

    useCart.getState().addItem(energy, RETAIL_PRICE);
    useCart.getState().openDrawer();

    const { items, drawerOpen } = useCart.getState();
    expect(items[0]).toMatchObject({ slug: "energy", price: 750, qty: 1 });
    expect(drawerOpen).toBe(true);
  });

  it("RETAIL_PRICE is 750", () => {
    expect(RETAIL_PRICE).toBe(750);
  });
});
