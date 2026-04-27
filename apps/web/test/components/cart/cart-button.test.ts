/**
 * CartButton — logic tests via store state (no DOM rendering; bun:test env has no jsdom)
 *
 * Covers:
 *  - badge visibility logic: count > 0 AND hydrated
 *  - hydration safety: count hidden when not yet hydrated
 *  - openDrawer action sets drawerOpen = true
 */
import { beforeEach, describe, expect, it } from "bun:test";
import { useCart, cartCount } from "@/components/cart/cart-store";

// ---------------------------------------------------------------------------
// In-memory localStorage polyfill
// ---------------------------------------------------------------------------
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
};
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

const energyItem = { slug: "energy", name: "Energy", price: 750, qty: 2, color: "", ink: "", image: "" };

beforeEach(() => {
  localStorage.clear();
  useCart.setState({ items: [], drawerOpen: false, hydrated: true });
});

describe("CartButton badge visibility logic", () => {
  it("no badge when cart empty (count === 0)", () => {
    useCart.setState({ items: [], hydrated: true });
    const { items, hydrated } = useCart.getState();
    const count = hydrated ? cartCount(items) : 0;
    // badge shown only when hydrated && count > 0
    expect(hydrated && count > 0).toBe(false);
  });

  it("badge shown when items exist and store hydrated", () => {
    useCart.setState({ items: [energyItem], hydrated: true });
    const { items, hydrated } = useCart.getState();
    const count = hydrated ? cartCount(items) : 0;
    expect(count).toBe(2);
    expect(hydrated && count > 0).toBe(true);
  });

  it("badge hidden when not yet hydrated (SSR safety)", () => {
    useCart.setState({ items: [energyItem], hydrated: false });
    const { items, hydrated } = useCart.getState();
    const count = hydrated ? cartCount(items) : 0;
    expect(count).toBe(0);
    expect(hydrated && count > 0).toBe(false);
  });

  it("openDrawer sets drawerOpen to true", () => {
    expect(useCart.getState().drawerOpen).toBe(false);
    useCart.getState().openDrawer();
    expect(useCart.getState().drawerOpen).toBe(true);
  });
});
