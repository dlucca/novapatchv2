import Link from "next/link";
import { getTranslations, getMessages } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface CardEntry {
  title: string;
  body: string;
}

function paragraphs(body: string) {
  return body.split("\n\n").map((p, i) => (
    <p key={i} className="mb-3 text-sm leading-relaxed text-muted-foreground last:mb-0">
      {p}
    </p>
  ));
}

export default async function InfluencersLandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.influencers" });
  const messages = (await getMessages({ locale })) as {
    pages: { influencers: { cards: Record<string, CardEntry> } };
  };
  const cardKeys = Object.keys(messages.pages.influencers.cards);

  return (
    <main>
      <section className="bg-brand-cream px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-brand-coral">
            {t("hero.eyebrow")}
          </p>
          <h1 className="mb-6 text-4xl font-black tracking-tight text-brand-deep-blue md:text-5xl">
            {t("hero.title")}
          </h1>
          <div className="max-w-3xl">{paragraphs(t("hero.body"))}</div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {cardKeys.map((slug) => (
            <Card key={slug}>
              <CardHeader>
                <CardTitle className="text-lg text-brand-deep-blue">
                  {t(`cards.${slug}.title`)}
                </CardTitle>
              </CardHeader>
              <CardContent>{paragraphs(t(`cards.${slug}.body`))}</CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link href={`/${locale}${t("cta.href")}`}>
            <Button size="lg" className="bg-brand-coral hover:bg-brand-coral/90">
              {t("cta.label")}
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
