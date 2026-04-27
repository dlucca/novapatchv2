"use client";

import { ChevronUp, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ProductMeta } from "@/lib/products";
import { perBox, discountPercent, type Freq } from "@/lib/plan-pricing";

export type ActiveItem = {
  p: ProductMeta;
  freq: Freq;
};

interface PlanBottomBarProps {
  items: ActiveItem[];
  monthly: number;
  saved: number;
  open: boolean;
  onToggle: () => void;
  onSubscribe: () => void;
}

export function PlanBottomBar({
  items,
  monthly,
  saved,
  open,
  onToggle,
  onSubscribe,
}: PlanBottomBarProps) {
  const t = useTranslations("pages.suscripciones.bottom_bar");
  const empty = items.length === 0;
  const expanded = open && !empty;
  const count = items.length;

  let label: string;
  if (empty) label = t("label_empty");
  else if (count === 1) label = t("label_one", { count });
  else label = t("label_many", { count });

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4"
    >
      <div
        className="pointer-events-auto w-full max-w-[560px] overflow-hidden rounded-3xl bg-navy text-white shadow-[0_24px_64px_rgba(13,27,53,0.32)] transition-all duration-300"
      >
        {/* Expanded breakdown */}
        <div
          className="overflow-hidden transition-[max-height] duration-300 ease-out"
          style={{ maxHeight: expanded ? 360 : 0 }}
        >
          <div className="px-5 pb-1 pt-5">
            <div className="mb-3.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">
              {t("breakdown_title")}
            </div>
            <ul className="m-0 mb-3.5 grid max-h-[200px] gap-2 overflow-y-auto p-0">
              {items.map((it) => {
                const price = perBox(it.freq);
                return (
                  <li
                    key={it.p.slug}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl bg-white/[0.06] p-3"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        background: it.p.color,
                        boxShadow: `0 0 0 3px ${it.p.color}33`,
                      }}
                    />
                    <div>
                      <div className="font-outfit text-sm font-bold">
                        {it.p.name}
                      </div>
                      <div className="mt-0.5 text-[11px] text-white/55">
                        {t("breakdown_row_sub", {
                          days: it.freq,
                          percent: discountPercent(it.freq),
                        })}
                      </div>
                    </div>
                    <span className="font-outfit text-sm font-extrabold">
                      ${price}
                    </span>
                  </li>
                );
              })}
            </ul>
            {saved > 0 && (
              <div
                className="mb-1 flex items-center justify-between rounded-xl px-3.5 py-2.5"
                style={{
                  background: "rgba(28,177,188,0.14)",
                  border: "1px solid rgba(28,177,188,0.28)",
                }}
              >
                <span className="text-[12.5px] text-[#9DE1E8]">{t("saved")}</span>
                <span className="font-outfit text-sm font-black text-teal">
                  {t("saved_amount", { amount: Math.round(saved) })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Always-visible footer row */}
        <div
          className="grid items-center gap-3.5 px-5 py-4 pl-5"
          style={{
            gridTemplateColumns: "1fr auto",
            borderTop: expanded ? "1px solid rgba(255,255,255,0.08)" : "none",
          }}
        >
          <button
            type="button"
            onClick={onToggle}
            disabled={empty}
            className="flex items-center gap-3 border-none bg-transparent p-0 text-left text-white"
            style={{ cursor: empty ? "default" : "pointer" }}
          >
            <div>
              <div className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">
                {label}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-outfit text-[26px] font-black leading-none tracking-tight">
                  ${empty ? 0 : Math.round(monthly)}
                </span>
                <span className="text-xs text-white/55">{t("monthly_unit")}</span>
                {!empty && (
                  <span
                    aria-hidden="true"
                    className="ml-1 inline-flex text-white/60 transition-transform duration-200"
                    style={{
                      transform: open ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  >
                    <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.6} />
                  </span>
                )}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onSubscribe}
            disabled={empty}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border-none px-5 py-3.5 font-outfit text-[14.5px] font-extrabold tracking-tight transition-all duration-200"
            style={{
              background: empty ? "rgba(255,255,255,0.1)" : "var(--color-coral)",
              color: empty ? "rgba(255,255,255,0.4)" : "#fff",
              cursor: empty ? "not-allowed" : "pointer",
              boxShadow: empty ? "none" : "0 8px 22px rgba(232,80,58,0.4)",
            }}
          >
            {empty ? t("cta_empty") : t("cta_subscribe")}
            {!empty && <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.6} />}
          </button>
        </div>
      </div>
    </div>
  );
}
