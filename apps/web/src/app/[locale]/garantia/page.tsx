import { getTranslations, getMessages } from "next-intl/server";

interface SectionEntry {
  title: string;
  body: string;
}

function paragraphs(body: string) {
  return body.split("\n\n").map((p, i) => (
    <p key={i} className="mb-4 text-base leading-relaxed text-muted-foreground last:mb-0">
      {p}
    </p>
  ));
}

export default async function GarantiaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.garantia" });
  const messages = (await getMessages({ locale })) as {
    pages: { garantia: { sections: Record<string, SectionEntry> } };
  };
  const sectionKeys = Object.keys(messages.pages.garantia.sections);

  return (
    <main>
      <section className="bg-cream px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-coral">
            {t("hero.eyebrow")}
          </p>
          <h1 className="mb-6 text-4xl font-black tracking-tight text-navy md:text-5xl">
            {t("hero.title")}
          </h1>
          <div className="max-w-3xl">{paragraphs(t("hero.body"))}</div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-6 py-16">
        {sectionKeys.map((slug) => (
          <section key={slug} className="mb-12 last:mb-0">
            <h2 className="mb-4 text-2xl font-bold text-navy">
              {t(`sections.${slug}.title`)}
            </h2>
            <div>{paragraphs(t(`sections.${slug}.body`))}</div>
          </section>
        ))}
      </div>
    </main>
  );
}
