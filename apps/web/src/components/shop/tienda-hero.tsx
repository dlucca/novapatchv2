import { getTranslations } from "next-intl/server";

interface TiendaHeroProps {
  locale: string;
}

export async function TiendaHero({ locale }: TiendaHeroProps) {
  const t = await getTranslations({ locale, namespace: "pages.tienda.hero" });
  return (
    <section className="bg-cream pt-24 pb-12">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <span className="text-xs uppercase tracking-wider text-coral">
          {t("eyebrow")}
        </span>
        <h1 className="mt-3 font-outfit text-4xl font-black leading-tight text-navy lg:text-6xl">
          {t("title_a")}{" "}
          <span className="font-newsreader italic font-normal text-coral">
            {t("title_b_italic")}
          </span>
        </h1>
        <p className="mt-4 text-navy/70">{t("lead")}</p>
      </div>
    </section>
  );
}
