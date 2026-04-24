import { getTranslations, getMessages } from "next-intl/server";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface QA {
  q: string;
  a: string;
}

function paragraphs(body: string) {
  return body.split("\n\n").map((p, i) => (
    <p key={i} className="mb-3 text-sm leading-relaxed text-muted-foreground last:mb-0">
      {p}
    </p>
  ));
}

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.faq" });
  const messages = (await getMessages({ locale })) as {
    pages: { faq: { questions: QA[] } };
  };
  const questions = messages.pages.faq.questions;

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
          <p className="max-w-3xl text-base text-muted-foreground md:text-lg">
            {t("hero.body")}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-6 py-16">
        <Accordion type="single" collapsible>
          {questions.map((qa, i) => (
            <AccordionItem key={i} value={`q-${i}`}>
              <AccordionTrigger className="text-left text-base font-medium text-brand-deep-blue">
                {qa.q}
              </AccordionTrigger>
              <AccordionContent>{paragraphs(qa.a)}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </main>
  );
}
