"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ProductMeta } from "@/lib/products";
import { RETAIL_PRICE } from "@/lib/products";
import { useCart } from "@/components/cart/cart-store";

interface ProductCardShopProps {
  product: ProductMeta;
  locale: string;
}

export function ProductCardShop({ product, locale }: ProductCardShopProps) {
  const t = useTranslations("pages.home.product_grid.card");
  const onAdd = () => {
    useCart.getState().addItem(product, RETAIL_PRICE);
    useCart.getState().openDrawer();
  };

  const href = `/${locale}/productos/${product.slug}`;

  return (
    <article
      data-slug={product.slug}
      data-testid={`pcard-${product.slug}`}
      className="group relative overflow-hidden rounded-3xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
    >
      <Link href={href} className="block">
        <div
          className="relative aspect-[1/1.05] overflow-hidden"
          style={{
            background: `radial-gradient(60% 60% at 50% 40%, ${product.color}55, ${product.bg})`,
          }}
        >
          {product.popular && (
            <span className="absolute left-3 top-3 rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold uppercase text-white">
              {t("popular")}
            </span>
          )}
          <Image
            src={product.image}
            alt={product.name}
            fill
            loading="lazy"
            sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw"
            className="object-contain p-8 transition-transform duration-500 [@media(hover:hover)]:group-hover:scale-105 [@media(hover:hover)]:group-hover:-rotate-2"
          />
        </div>
        <div className="px-5 pt-5">
          <p
            data-testid="pcard-name"
            className="font-outfit text-2xl font-black text-navy"
          >
            {product.name}
          </p>
          <p className="text-sm text-navy/70">
            {product.tagline} · {t("units_short")}
          </p>
        </div>
      </Link>
      <div className="px-5 pb-5">
        <hr className="my-3 border-navy/10" />
        <div className="flex items-center justify-between">
          <div>
            <p className="font-outfit text-xl font-black text-navy">
              ${RETAIL_PRICE}
            </p>
            <p className="text-xs text-navy/60">{t("price_per_month")}</p>
          </div>
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1 rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white hover:bg-coral/90"
          >
            {t("add")} +
          </button>
        </div>
      </div>
    </article>
  );
}
