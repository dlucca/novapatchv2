"use client";

import { useTranslations } from "next-intl";
import { scrollToAnchor } from "@/lib/home-anchors";

export function FinalCTA() {
  const t = useTranslations("pages.home.final_cta");
  return (
    <section className="relative overflow-hidden bg-navy py-24 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(700px 400px at 30% 30%, rgba(242,92,84,0.18), transparent 60%), radial-gradient(700px 400px at 70% 70%, rgba(30,177,188,0.18), transparent 60%)",
        }}
      />
      <div className="relative mx-auto max-w-3xl px-4">
        <h2 className="font-outfit text-4xl font-black text-white lg:text-6xl">
          {t("title_a")}{" "}
          <span className="font-newsreader italic font-normal text-[var(--gold)]">
            {t("title_b_italic")}
          </span>
          .
        </h2>
        <p className="mt-4 text-white/80">{t("lead")}</p>
        <button
          type="button"
          onClick={() => scrollToAnchor("products")}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-coral px-8 py-4 text-lg font-semibold text-white hover:bg-coral/90"
        >
          {t("cta")} →
        </button>
      </div>
    </section>
  );
}
