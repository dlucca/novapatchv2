import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { NOVA_PRODUCTS, type ProductMeta } from "@/lib/products";

export function ProductGrid({ locale }: { locale: string }) {
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
            <ProductCard key={p.slug} p={p} locale={locale} />
          ))}
        </div>

        <div className="mt-12 flex justify-center">
          <Link
            href={`/${locale}/tienda`}
            className="inline-flex items-center gap-2 rounded-full border border-navy bg-white px-6 py-3 text-base font-semibold text-navy transition hover:bg-coral hover:border-coral hover:text-white"
          >
            {t("cta_all")}
          </Link>
        </div>
      </div>
    </section>
  );
}

function ProductCard({ p, locale }: { p: ProductMeta; locale: string }) {
  const t = useTranslations("pages.home.product_grid.card");
  return (
    <Link
      href={`/${locale}/productos/${p.slug}`}
      data-slug={p.slug}
      data-testid={`pcard-${p.slug}`}
      className="group relative block overflow-hidden rounded-3xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
    >
      <article>
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
          <p className="text-sm text-navy/70">{p.tagline}</p>
          <p className="mt-3 text-sm font-semibold text-coral transition group-hover:translate-x-0.5">
            {t("see_details")}
          </p>
        </div>
      </article>
    </Link>
  );
}
