import { beforeEach, describe, expect, it } from "bun:test";
import { useCart, cartCount, cartTotal } from "@/components/cart/cart-store";
import type { ProductMeta } from "@/lib/products";

// ---------------------------------------------------------------------------
// In-memory localStorage polyfill (Node / bun test environment has no DOM)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
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

const glow: ProductMeta = {
  ...energy,
  slug: "glow",
  name: "Glow",
  color: "#F25C54",
  ink: "#B83525",
};

beforeEach(() => {
  localStorage.clear();
  useCart.setState({ items: [], drawerOpen: false });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("cart-store", () => {
  it("addItem on a new slug appends with qty=1", () => {
    useCart.getState().addItem(energy, 750);
    expect(useCart.getState().items).toEqual([
      expect.objectContaining({ slug: "energy", name: "Energy", price: 750, qty: 1 }),
    ]);
  });

  it("addItem on an existing slug increments qty", () => {
    useCart.getState().addItem(energy, 750);
    useCart.getState().addItem(energy, 750);
    expect(useCart.getState().items).toHaveLength(1);
    expect(useCart.getState().items[0]?.qty).toBe(2);
  });

  it("removeItem deletes by slug", () => {
    useCart.getState().addItem(energy, 750);
    useCart.getState().addItem(glow, 750);
    useCart.getState().removeItem("energy");
    expect(useCart.getState().items.map((i) => i.slug)).toEqual(["glow"]);
  });

  it("setQty updates a positive qty", () => {
    useCart.getState().addItem(energy, 750);
    useCart.getState().setQty("energy", 5);
    expect(useCart.getState().items[0]?.qty).toBe(5);
  });

  it("setQty(slug, 0) removes the item", () => {
    useCart.getState().addItem(energy, 750);
    useCart.getState().setQty("energy", 0);
    expect(useCart.getState().items).toEqual([]);
  });

  it("clear empties items", () => {
    useCart.getState().addItem(energy, 750);
    useCart.getState().addItem(glow, 750);
    useCart.getState().clear();
    expect(useCart.getState().items).toEqual([]);
  });

  it("openDrawer / closeDrawer toggle drawerOpen", () => {
    useCart.getState().openDrawer();
    expect(useCart.getState().drawerOpen).toBe(true);
    useCart.getState().closeDrawer();
    expect(useCart.getState().drawerOpen).toBe(false);
  });

  it("persist round-trips items through localStorage under key novapatch.cart.v1", () => {
    useCart.getState().addItem(energy, 750);
    useCart.getState().setQty("energy", 3);
    const raw = localStorage.getItem("novapatch.cart.v1");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed.state.items[0]).toMatchObject({ slug: "energy", qty: 3 });
  });

  it("cartCount sums quantities", () => {
    expect(cartCount([])).toBe(0);
    expect(
      cartCount([
        { slug: "energy", name: "Energy", price: 750, qty: 2, color: "", ink: "", image: "" },
        { slug: "glow", name: "Glow", price: 750, qty: 3, color: "", ink: "", image: "" },
      ]),
    ).toBe(5);
  });

  it("cartTotal sums price * qty", () => {
    expect(
      cartTotal([
        { slug: "energy", name: "Energy", price: 750, qty: 2, color: "", ink: "", image: "" },
        { slug: "glow", name: "Glow", price: 700, qty: 1, color: "", ink: "", image: "" },
      ]),
    ).toBe(2200);
  });
});
