"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { NOVA_PRODUCTS, RETAIL_PRICE, type ProductMeta } from "@/lib/products";
import { useCart } from "@/components/cart/cart-store";

export function ProductGrid() {
  const t = useTranslations("pages.home.product_grid");
  return (
    <section id="productos" className="bg-cream py-20">
      <div className="mx-auto max-w-6xl px-4">
        <span className="text-xs uppercase tracking-wider text-coral">
          {t("eyebrow")}
        </span>
        <h2 className="mt-3 font-outfit text-4xl font-black leading-tight text-navy lg:text-5xl">
          {t("title_a")}{" "}
          <span className="font-newsreader italic font-normal text-coral">
            {t("title_b_italic")}
          </span>
        </h2>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {NOVA_PRODUCTS.map((p) => (
            <ProductCard key={p.slug} p={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductCard({ p }: { p: ProductMeta }) {
  const t = useTranslations("pages.home.product_grid.card");
  const onAdd = () => {
    useCart.getState().addItem(p, RETAIL_PRICE);
    useCart.getState().openDrawer();
  };
  return (
    <article
      data-slug={p.slug}
      data-testid={`pcard-${p.slug}`}
      className="group relative overflow-hidden rounded-3xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
    >
      <div
        className="relative aspect-[1/1.05] overflow-hidden"
        style={{
          background: `radial-gradient(60% 60% at 50% 40%, ${p.color}55, ${p.bg})`,
        }}
      >
        {p.popular && (
          <span className="absolute left-3 top-3 rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            {t("popular")}
          </span>
        )}
        <Image
          src={p.image}
          alt={p.name}
          fill
          loading="lazy"
          sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw"
          className="object-contain p-8 transition-transform duration-500 [@media(hover:hover)]:group-hover:scale-105 [@media(hover:hover)]:group-hover:-rotate-2"
        />
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap gap-1 opacity-0 transition-opacity [@media(hover:hover)]:group-hover:opacity-100">
          {p.ingredients.slice(0, 3).map((ing) => (
            <span
              key={ing}
              className="rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-navy"
            >
              {ing}
            </span>
          ))}
          {p.ingredients.length > 3 && (
            <span className="rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-navy">
              +{p.ingredients.length - 3}
            </span>
          )}
        </div>
      </div>

      <div className="p-5">
        <p
          data-testid="pcard-name"
          className="font-outfit text-2xl font-black text-navy"
        >
          {p.name}
        </p>
        <p className="text-sm text-navy/70">
          {p.tagline} · {t("units_short")}
        </p>
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
