/**
 * CartDrawer — smoke import + store-driven behavior tests.
 *
 * The bun:test environment has no jsdom and no @testing-library/react, so we
 * don't render the React tree. Instead we:
 *   1. Smoke-import CartDrawer to verify the module loads & exports a function.
 *   2. Drive the cart store directly to exercise the behaviors that the drawer
 *      delegates to it (qty +/-, remove, clear, drawerOpen toggling).
 */
import { beforeEach, describe, expect, it } from "bun:test";
import { useCart } from "@/components/cart/cart-store";
import { CartDrawer } from "@/components/cart/cart-drawer";

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

const energyItem = {
  slug: "energy",
  name: "Energy",
  price: 750,
  qty: 2,
  color: "#83B5F4",
  ink: "#1A5C9A",
  image: "/products/Energy.webp",
};

beforeEach(() => {
  localStorage.clear();
  useCart.setState({ items: [], drawerOpen: false, hydrated: true });
});

describe("CartDrawer module", () => {
  it("exports a function component", () => {
    expect(typeof CartDrawer).toBe("function");
  });
});

describe("CartDrawer behaviors (via store)", () => {
  it("closeDrawer flips drawerOpen to false", () => {
    useCart.setState({ drawerOpen: true });
    useCart.getState().closeDrawer();
    expect(useCart.getState().drawerOpen).toBe(false);
  });

  it("setQty(slug, qty+1) increments quantity", () => {
    useCart.setState({ items: [energyItem] });
    useCart.getState().setQty("energy", energyItem.qty + 1);
    expect(useCart.getState().items[0]?.qty).toBe(3);
  });

  it("setQty(slug, qty-1) decrements; at qty=1 the item is removed", () => {
    useCart.setState({ items: [{ ...energyItem, qty: 2 }] });
    useCart.getState().setQty("energy", 1);
    expect(useCart.getState().items[0]?.qty).toBe(1);
    useCart.getState().setQty("energy", 0);
    expect(useCart.getState().items).toHaveLength(0);
  });

  it("removeItem deletes the row", () => {
    useCart.setState({ items: [energyItem] });
    useCart.getState().removeItem("energy");
    expect(useCart.getState().items).toHaveLength(0);
  });

  it("clear empties items", () => {
    useCart.setState({ items: [energyItem] });
    useCart.getState().clear();
    expect(useCart.getState().items).toHaveLength(0);
  });

  it("preserves subscription metadata on a cart item through the store", () => {
    const subItem = {
      ...energyItem,
      qty: 1,
      price: 600,
      subscription: { interval_days: 30 as const, discount_percentage: 20 as const },
    };
    useCart.setState({ items: [subItem] });
    const got = useCart.getState().items[0];
    expect(got?.subscription).toEqual({
      interval_days: 30,
      discount_percentage: 20,
    });
  });
});
