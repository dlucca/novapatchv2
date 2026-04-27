import { describe, expect, it, beforeEach } from "bun:test";
import { TiendaHero } from "@/components/shop/tienda-hero";
import { ProductCardShop } from "@/components/shop/product-card-shop";
import { ProductGridShop } from "@/components/shop/product-grid-shop";
import { useCart } from "@/components/cart/cart-store";
import { NOVA_PRODUCTS, RETAIL_PRICE } from "@/lib/products";

beforeEach(() => {
  useCart.setState({ items: [], drawerOpen: false, hydrated: true });
});

describe("Shop components", () => {
  it("TiendaHero exports a function", () => {
    expect(typeof TiendaHero).toBe("function");
  });
  it("ProductCardShop exports a function", () => {
    expect(typeof ProductCardShop).toBe("function");
  });
  it("ProductGridShop exports a function", () => {
    expect(typeof ProductGridShop).toBe("function");
  });

  it("addItem from card flow works", () => {
    const p = NOVA_PRODUCTS[0]!;
    useCart.getState().addItem(p, RETAIL_PRICE);
    useCart.getState().openDrawer();
    expect(useCart.getState().items[0]?.slug).toBe(p.slug);
    expect(useCart.getState().drawerOpen).toBe(true);
  });
});
