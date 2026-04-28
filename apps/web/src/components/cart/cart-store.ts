import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProductMeta } from "@/lib/products";
import type { PersistStorage, StorageValue } from "zustand/middleware";

export type CartSubscription = {
  interval_days: 30 | 60 | 90;
  discount_percentage: 15 | 10 | 5;
};

export type CartItem = {
  slug: string;
  name: string;
  price: number;
  qty: number;
  color: string;
  ink: string;
  image: string;
  subscription?: CartSubscription;
};

type CartState = {
  items: CartItem[];
  drawerOpen: boolean;
  hydrated: boolean;
  addItem: (p: ProductMeta, price: number, subscription?: CartSubscription) => void;
  removeItem: (slug: string) => void;
  setQty: (slug: string, qty: number) => void;
  clear: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
};

// Lazy storage adapter — resolves localStorage at call time so the store can
// be imported in non-browser environments (SSR, tests) without throwing.
const lazyLocalStorage: PersistStorage<{ items: CartItem[] }> = {
  getItem: (name) => {
    try {
      const raw = globalThis.localStorage?.getItem(name);
      return raw ? (JSON.parse(raw) as StorageValue<{ items: CartItem[] }>) : null;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      globalThis.localStorage?.setItem(name, JSON.stringify(value));
    } catch {
      // ignore write errors (e.g. private browsing quota)
    }
  },
  removeItem: (name) => {
    try {
      globalThis.localStorage?.removeItem(name);
    } catch {
      // ignore
    }
  },
};

// Dedupe key: subscription items share a line only when both slug AND interval
// match. Different intervals for the same slug = separate lines.
const sameLine = (i: CartItem, slug: string, sub?: CartSubscription) => {
  if (!sub) return i.slug === slug && !i.subscription;
  return i.slug === slug && i.subscription?.interval_days === sub.interval_days;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      drawerOpen: false,
      hydrated: false,
      addItem: (p, price, subscription) =>
        set((s) => {
          const ex = s.items.find((i) => sameLine(i, p.slug, subscription));
          if (ex) {
            return {
              items: s.items.map((i) =>
                sameLine(i, p.slug, subscription) ? { ...i, qty: i.qty + 1 } : i,
              ),
            };
          }
          const newItem: CartItem = {
            slug: p.slug,
            name: p.name,
            price,
            qty: 1,
            color: p.color,
            ink: p.ink,
            image: p.image,
            ...(subscription !== undefined && { subscription }),
          };
          return { items: [...s.items, newItem] };
        }),
      removeItem: (slug) =>
        set((s) => ({ items: s.items.filter((i) => i.slug !== slug) })),
      setQty: (slug, qty) =>
        set((s) => ({
          items:
            qty <= 0
              ? s.items.filter((i) => i.slug !== slug)
              : s.items.map((i) => (i.slug === slug ? { ...i, qty } : i)),
        })),
      clear: () => set({ items: [] }),
      openDrawer: () => set({ drawerOpen: true }),
      closeDrawer: () => set({ drawerOpen: false }),
    }),
    {
      name: "novapatch.cart.v1",
      storage: lazyLocalStorage,
      partialize: (s) => ({ items: s.items }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);

export const cartCount = (items: CartItem[]): number =>
  items.reduce((s, i) => s + i.qty, 0);

export const cartTotal = (items: CartItem[]): number =>
  items.reduce((s, i) => s + i.price * i.qty, 0);
