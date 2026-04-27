import { describe, expect, it } from "bun:test";
import { buildPdpJsonLd } from "@/components/pdp/pdp-jsonld";
import { NOVA_PRODUCTS, RETAIL_PRICE } from "@/lib/products";
import { PRODUCTS_CONTENT } from "@/lib/products-content";

describe("buildPdpJsonLd", () => {
  it("emits a Product schema with the right fields", () => {
    const product = NOVA_PRODUCTS.find((p) => p.slug === "energy")!;
    const content = PRODUCTS_CONTENT["energy"];
    const data = buildPdpJsonLd({
      product,
      content,
      siteUrl: "https://novapatch.com",
      locale: "mx",
    });
    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@type"]).toBe("Product");
    expect(data.name).toContain("Energy");
    expect(data.image).toBe("https://novapatch.com/products/Energy.webp");
    expect(data.offers.price).toBe(RETAIL_PRICE);
    expect(data.offers.priceCurrency).toBe("MXN");
    expect(data.offers.url).toBe("https://novapatch.com/mx/productos/energy");
  });
});
