"use client";

import { useTranslations } from "next-intl";
import { discountPercent, type Freq } from "@/lib/plan-pricing";

const TIERS: { freq: Freq; color: string; key: "30" | "60" | "90" }[] = [
  { freq: 30, color: "var(--color-teal)", key: "30" },
  { freq: 60, color: "var(--color-sky)", key: "60" },
  { freq: 90, color: "var(--color-gold)", key: "90" },
];

export function PlanLegend() {
  const t = useTranslations("pages.suscripciones.legend");

  return (
    <div className="mb-14 rounded-3xl border border-navy/5 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-teal">
          {t("eyebrow")}
        </span>
        <span className="h-px flex-1 bg-navy/10" />
      </div>

      <p className="mb-5 max-w-xl text-[14.5px] leading-relaxed text-navy/75">
        {t("intro")}
      </p>

      <div className="relative px-1">
        {/* Track */}
        <div
          aria-hidden="true"
          className="absolute left-3 right-3 top-[18px] h-[3px] rounded-full opacity-35"
          style={{
            background:
              "linear-gradient(90deg, var(--color-teal) 0%, var(--color-sky) 50%, var(--color-gold) 100%)",
          }}
        />
        <div className="relative grid grid-cols-3 gap-2.5">
          {TIERS.map((tier) => (
            <div
              key={tier.key}
              className="flex flex-col items-center text-center"
            >
              <span
                className="relative z-10 mt-[11px] h-3.5 w-3.5 rounded-full"
                style={{
                  background: tier.color,
                  boxShadow: `0 0 0 5px ${tier.color}26, 0 0 0 1px #fff inset`,
                }}
              />
              <div className="mt-3 font-outfit text-[13px] font-extrabold tracking-wide text-navy/60">
                {t("every_n_days", { days: tier.freq })}
              </div>
              <div className="mt-1 font-outfit text-3xl font-black leading-none tracking-tight text-navy">
                −{discountPercent(tier.freq)}
                <span className="text-base font-bold text-navy/50">%</span>
              </div>
              <div
                className="mt-2 font-outfit text-[13px] font-bold"
                style={{ color: tier.color }}
              >
                {t(`tiers.${tier.key}.label`)}
              </div>
              <div className="mt-1 max-w-[130px] text-[11.5px] leading-snug text-navy/55">
                {t(`tiers.${tier.key}.sub`)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
