import { getTranslations } from "next-intl/server";

export default async function InfluencersAplicarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.influencers_aplicar" });

  return (
    <main>
      <section className="bg-brand-cream px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-brand-coral">
            {t("hero.eyebrow")}
          </p>
          <h1 className="mb-6 text-4xl font-black tracking-tight text-brand-deep-blue md:text-5xl">
            {t("hero.title")}
          </h1>
          <p className="text-base text-muted-foreground md:text-lg">{t("hero.body")}</p>
        </div>
      </section>
    </main>
  );
}
