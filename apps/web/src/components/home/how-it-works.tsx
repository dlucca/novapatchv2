"use client";

import Image from "next/image";
import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";

const STEPS = [
  { n: "01", k: "1", color: "var(--coral)" },
  { n: "02", k: "2", color: "var(--teal)" },
  { n: "03", k: "3", color: "var(--gold)" },
] as const;

export function HowItWorks() {
  const t = useTranslations("pages.home.how_it_works");
  return (
    <section className="bg-cream py-20">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 lg:grid-cols-[1fr_1.05fr] lg:items-center">
        <div>
          <span className="text-xs uppercase tracking-wider text-coral">{t("eyebrow")}</span>
          <h2 className="mt-3 font-outfit text-4xl font-black leading-tight text-navy lg:text-6xl">
            {t("title_a")}{" "}
            <span className="font-newsreader italic font-normal text-coral">{t("title_b_italic")}</span>
          </h2>
          <p className="mt-5 max-w-md text-base text-navy/70">{t("lead")}</p>
          <ul className="mt-8 space-y-4">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-4 rounded-2xl bg-white p-5 shadow-sm">
                <span className="font-outfit text-2xl font-black" style={{ color: s.color }}>
                  {s.n}
                </span>
                <div>
                  <p className="font-outfit text-lg font-black text-navy">{t(`steps.${s.k}.title`)}</p>
                  <p className="text-sm text-navy/70">{t(`steps.${s.k}.desc`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div
          className="relative aspect-[1/1.15] overflow-hidden rounded-[32px]"
          style={{ boxShadow: "0 30px 80px rgba(13,27,53,0.18)" }}
        >
          <Image
            src="/products/lifestyle-apply.webp"
            alt={t("photo_alt")}
            fill
            sizes="(min-width:1024px) 600px, 100vw"
            className="object-cover"
          />
          <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-navy">
            <span className="h-2 w-2 animate-pulse rounded-full bg-teal" /> {t("annotation_apply")}
          </div>
          <div className="absolute bottom-4 right-4 max-w-[220px] rounded-2xl bg-navy p-3 text-white">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" aria-hidden />
              <span className="text-sm font-bold">10–12h</span>
            </div>
            <p className="mt-1 text-xs text-white/80">{t("duration_label")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
