import { describe, it, expect } from "bun:test";
import { app } from "../src/index";

type CatalogListBody = {
  market: string;
  currency: string;
  products: Array<{
    slug: string;
    name: string;
    description: string;
    images: string[];
    price: number;
    currency: string;
    subscriptionPrices: Record<string, number>;
  }>;
};

type ProductBody = CatalogListBody["products"][number];
type ErrorBody = { error: { code: string; message: string } };

describe("GET /catalog", () => {
  it("returns all 6 products with MX prices when market=mx", async () => {
    const res = await app.fetch(new Request("http://localhost/catalog?market=mx"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as CatalogListBody;
    expect(body.market).toBe("mx");
    expect(body.currency).toBe("MXN");
    expect(body.products).toHaveLength(6);
    const energy = body.products[0];
    expect(energy?.slug).toBe("energy");
    expect(energy?.price).toBe(45000);
    expect(energy?.subscriptionPrices).toEqual({
      "30": 36000,
      "60": 38250,
      "90": 40500,
    });
  });

  it("returns products in canonical display order", async () => {
    const res = await app.fetch(new Request("http://localhost/catalog?market=mx"));
    const body = (await res.json()) as CatalogListBody;
    const slugs = body.products.map((p) => p.slug);
    expect(slugs).toEqual(["energy", "sleep", "glow", "shield", "zen", "woman"]);
  });

  it("returns 400 for unknown market", async () => {
    const res = await app.fetch(new Request("http://localhost/catalog?market=us"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing market", async () => {
    const res = await app.fetch(new Request("http://localhost/catalog"));
    expect(res.status).toBe(400);
  });
});

describe("GET /catalog/:slug", () => {
  it("returns single product with prices resolved for the market", async () => {
    const res = await app.fetch(new Request("http://localhost/catalog/energy?market=mx"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as ProductBody;
    expect(body.slug).toBe("energy");
    expect(body.name).toBe("Energy");
    expect(body.price).toBe(45000);
    expect(body.currency).toBe("MXN");
    expect(body.subscriptionPrices).toEqual({
      "30": 36000,
      "60": 38250,
      "90": 40500,
    });
  });

  it("returns 404 + code=product_not_found for unknown slug", async () => {
    const res = await app.fetch(new Request("http://localhost/catalog/unknown?market=mx"));
    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("product_not_found");
    expect(body.error.message).toMatch(/not found/i);
  });

  it("returns 400 for missing market", async () => {
    const res = await app.fetch(new Request("http://localhost/catalog/energy"));
    expect(res.status).toBe(400);
  });
});
