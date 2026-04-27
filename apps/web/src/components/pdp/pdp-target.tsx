import { getTranslations } from "next-intl/server";
import type { ProductContent } from "@/lib/products-content";

interface PdpTargetProps {
  locale: string;
  content: ProductContent["target"];
}

export async function PdpTarget({ locale, content }: PdpTargetProps) {
  const t = await getTranslations({
    locale,
    namespace: "pages.productos.section_titles",
  });

  return (
    <section className="bg-cream py-20">
      <div className="mx-auto max-w-5xl px-4">
        <span className="text-xs uppercase tracking-wider text-coral">
          {t("target_eyebrow")}
        </span>
        <h2 className="mt-3 font-outfit text-3xl font-black leading-tight text-navy lg:text-4xl">
          {t("target_title")}
        </h2>

        <div className="mt-10 grid gap-10 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-navy/60">
              {content.primary_eyebrow}
            </p>
            <ul className="mt-4 space-y-3">
              {content.primary.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-1 inline-grid h-5 w-5 shrink-0 place-items-center rounded-full bg-coral text-white text-[11px] font-bold"
                  >
                    ✓
                  </span>
                  <span className="text-sm text-navy/80">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-navy/60">
              {content.not_for_eyebrow}
            </p>
            <ul className="mt-4 space-y-3">
              {content.not_for.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-1 inline-grid h-5 w-5 shrink-0 place-items-center rounded-full bg-navy/15 text-navy/50 text-[11px] font-bold"
                  >
                    ✕
                  </span>
                  <span className="text-sm text-navy/70">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
