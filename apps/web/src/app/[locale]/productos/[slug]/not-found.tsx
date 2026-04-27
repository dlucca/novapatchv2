import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function ProductNotFound() {
  // not-found.tsx does not receive params in App Router; default to "mx".
  const locale = "mx";
  const t = await getTranslations({
    locale,
    namespace: "pages.productos.not_found",
  });
  return (
    <section className="bg-cream py-32">
      <div className="mx-auto max-w-xl px-4 text-center">
        <h1 className="font-outfit text-3xl font-black text-navy lg:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-4 text-navy/70">{t("lead")}</p>
        <Link
          href={`/${locale}/tienda`}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white hover:bg-coral/90"
        >
          {t("cta")}
        </Link>
      </div>
    </section>
  );
}
