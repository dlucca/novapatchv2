"use client";

import { useTranslations } from "next-intl";
import type { ProductContent } from "@/lib/products-content";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

interface PdpFaqProps {
  faq: ProductContent["faq"];
}

export function PdpFaq({ faq }: PdpFaqProps) {
  const t = useTranslations("pages.productos.section_titles");

  return (
    <section id="faq" className="bg-cream py-20">
      <div className="mx-auto max-w-3xl px-4">
        <span className="text-xs uppercase tracking-wider text-coral">
          {t("faq_eyebrow")}
        </span>
        <h2 className="mt-3 font-outfit text-3xl font-black leading-tight text-navy lg:text-4xl">
          {t("faq_title")}
        </h2>
        <Accordion
          type="single"
          collapsible
          className="mt-8 divide-y divide-navy/10 rounded-3xl border border-navy/10 bg-white"
        >
          {faq.map((item, idx) => (
            <AccordionItem key={item.q} value={`faq-${idx}`} className="px-5">
              <AccordionTrigger className="text-left font-outfit text-base font-semibold text-navy">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-sm text-navy/75">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
