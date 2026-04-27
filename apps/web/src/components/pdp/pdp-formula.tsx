import { getTranslations } from "next-intl/server";
import type { ProductContent } from "@/lib/products-content";

interface PdpFormulaProps {
  locale: string;
  content: ProductContent["formula"];
}

export async function PdpFormula({ locale, content }: PdpFormulaProps) {
  const t = await getTranslations({
    locale,
    namespace: "pages.productos.formula",
  });

  return (
    <section id="formula" className="bg-[var(--color-blush)] py-20">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <div>
          <span className="text-xs uppercase tracking-wider text-coral">
            {content.eyebrow}
          </span>
          <h2 className="mt-3 font-outfit text-3xl font-black leading-tight text-navy lg:text-4xl">
            {content.title}
          </h2>
          <p className="mt-5 text-base text-navy/75">{content.lead}</p>
          <a
            href="#ciencia"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-navy shadow-sm hover:bg-coral hover:text-white"
          >
            {t("daltons_callout")}
          </a>
        </div>

        <ul className="space-y-3 lg:mt-10">
          {content.ingredients.map((ing) => (
            <li
              key={ing.name}
              className="flex flex-col gap-1 rounded-2xl bg-white/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
            >
              <span className="font-outfit text-lg font-black text-navy">
                {ing.name}
              </span>
              <span className="text-sm text-navy/70">{ing.role}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
