import { describe, expect, it, beforeEach } from "bun:test";
import { PdpCtaBlock } from "@/components/pdp/pdp-cta-block";
import { useCart } from "@/components/cart/cart-store";
import { NOVA_PRODUCTS, RETAIL_PRICE } from "@/lib/products";

beforeEach(() => {
  useCart.setState({ items: [], drawerOpen: false, hydrated: true });
});

describe("PdpCtaBlock", () => {
  it("exports a function", () => {
    expect(typeof PdpCtaBlock).toBe("function");
  });

  it("addItem flow at retail price for one-time mode", () => {
    const p = NOVA_PRODUCTS.find((x) => x.slug === "energy")!;
    useCart.getState().addItem(p, RETAIL_PRICE);
    useCart.getState().openDrawer();
    expect(useCart.getState().items[0]).toMatchObject({
      slug: "energy",
      price: 750,
      qty: 1,
    });
    expect(useCart.getState().items[0]?.subscription).toBeUndefined();
    expect(useCart.getState().drawerOpen).toBe(true);
  });

  it("subscribe flow at 30 days lands subscription metadata + correct price", () => {
    const p = NOVA_PRODUCTS.find((x) => x.slug === "glow")!;
    const perBox = Math.round(RETAIL_PRICE * 0.8);
    useCart
      .getState()
      .addItem(p, perBox, { interval_days: 30, discount_percentage: 20 });
    expect(useCart.getState().items[0]).toMatchObject({
      slug: "glow",
      price: perBox,
      qty: 1,
      subscription: { interval_days: 30, discount_percentage: 20 },
    });
  });
});
