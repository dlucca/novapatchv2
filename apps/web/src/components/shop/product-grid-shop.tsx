"use client";

import { NOVA_PRODUCTS } from "@/lib/products";
import { ProductCardShop } from "@/components/shop/product-card-shop";

interface ProductGridShopProps {
  locale: string;
}

export function ProductGridShop({ locale }: ProductGridShopProps) {
  return (
    <section className="bg-cream pb-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {NOVA_PRODUCTS.map((p) => (
            <ProductCardShop key={p.slug} product={p} locale={locale} />
          ))}
        </div>
      </div>
    </section>
  );
}
