import { getTranslations, getMessages } from "next-intl/server";

interface Section {
  title: string;
  body: string;
}

function paragraphs(body: string) {
  return body.split("\n\n").map((p, i) => (
    <p key={i} className="mb-4 text-sm leading-relaxed text-muted-foreground last:mb-0">
      {p}
    </p>
  ));
}

export default async function TerminosInfluencersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.terminos_influencers" });
  const messages = (await getMessages({ locale })) as {
    pages: { terminos_influencers: { sections: Section[] } };
  };
  const sections = messages.pages.terminos_influencers.sections;

  return (
    <main>
      <section className="bg-brand-cream px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-coral">
            {t("hero.eyebrow")}
          </p>
          <h1 className="mb-4 text-3xl font-black tracking-tight text-brand-deep-blue md:text-4xl">
            {t("hero.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("hero.body")}</p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-6 py-12">
        {sections.map((s, i) => (
          <section key={i} className="mb-10 last:mb-0">
            <h2 className="mb-3 text-lg font-bold text-brand-deep-blue">{s.title}</h2>
            <div>{paragraphs(s.body)}</div>
          </section>
        ))}
      </div>
    </main>
  );
}
