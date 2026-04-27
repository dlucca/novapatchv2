"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ProductMeta } from "@/lib/products";
import { RETAIL_PRICE } from "@/lib/products";
import { perBox, discountPercent, type Freq } from "@/lib/plan-pricing";
import { PlanToggle } from "@/components/plan/plan-toggle";

interface PlanCardProps {
  p: ProductMeta;
  active: boolean;
  freq: Freq;
  onToggle: () => void;
  onFreqChange: (f: Freq) => void;
}

const FREQS: Freq[] = [30, 60, 90];

export function PlanCard({ p, active, freq, onToggle, onFreqChange }: PlanCardProps) {
  const t = useTranslations("pages.suscripciones.card");
  const price = perBox(freq);

  return (
    <article
      className="overflow-hidden rounded-3xl transition-all duration-300 ease-out"
      style={{
        background: active ? p.bg : "#fff",
        border: `2px solid ${active ? p.color : "rgba(13,27,53,0.06)"}`,
        boxShadow: active
          ? `0 16px 36px ${p.color}26`
          : "0 4px 14px rgba(13,27,53,0.04)",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={active}
        className="grid w-full cursor-pointer items-center gap-4 border-none bg-transparent px-5 py-5 text-left"
        style={{ gridTemplateColumns: "76px 1fr auto" }}
      >
        <div
          className="flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-2xl transition-colors duration-200"
          style={{ background: active ? "rgba(255,255,255,0.6)" : p.bg }}
        >
          <Image
            src={p.image}
            alt={p.name}
            width={50}
            height={70}
            className="h-[70px] w-[50px] object-contain transition-[filter] duration-200"
            style={{
              filter: active ? `drop-shadow(0 6px 10px ${p.color}55)` : "none",
            }}
          />
        </div>

        <div>
          <div
            className="font-outfit text-[22px] font-black leading-tight tracking-tight"
            style={{ color: p.ink }}
          >
            {p.name}
          </div>
          <div className="mt-1 text-[13.5px] leading-snug text-navy/60">
            {p.tagline}
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span
              className="font-outfit text-[15px] font-extrabold tracking-tight"
              style={{ color: active ? p.ink : "rgba(13,27,53,0.7)" }}
            >
              ${active ? price : RETAIL_PRICE}
            </span>
            <span className="text-[11.5px] text-navy/50">{t("per_box")}</span>
            {active && (
              <span
                className="ml-1 rounded-full px-2 py-0.5 font-outfit text-[10.5px] font-extrabold tracking-wide text-white"
                style={{ background: p.color }}
              >
                {t("discount_pill", { percent: discountPercent(freq) })}
              </span>
            )}
          </div>
        </div>

        <PlanToggle active={active} color={p.color} />
      </button>

      {/* Frequency picker — expanded only when active */}
      <div
        className="overflow-hidden transition-[max-height] duration-300 ease-out"
        style={{ maxHeight: active ? 200 : 0 }}
      >
        <div
          className="px-5 pb-5 pt-4"
          style={{ borderTop: `1px dashed ${p.color}55` }}
        >
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-navy/55">
            {t("freq_label")}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {FREQS.map((f) => {
              const sel = freq === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFreqChange(f);
                  }}
                  className="cursor-pointer rounded-2xl px-2 py-3.5 text-center font-outfit transition-all duration-150"
                  style={{
                    background: sel ? p.ink : "rgba(255,255,255,0.6)",
                    color: sel ? "#fff" : "rgba(13,27,53,0.75)",
                    border: `2px solid ${sel ? p.ink : "rgba(13,27,53,0.08)"}`,
                  }}
                >
                  <div className="text-base font-extrabold leading-tight tracking-tight">
                    {f}
                    <span className="text-[11px] font-semibold opacity-70">d</span>
                  </div>
                  <div
                    className="mt-1 text-[11px] font-bold"
                    style={{
                      color: p.color,
                      opacity: sel ? 1 : 0.85,
                    }}
                  >
                    −{discountPercent(f)}%
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </article>
  );
}
