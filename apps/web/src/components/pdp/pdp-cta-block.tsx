"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import type { ProductMeta } from "@/lib/products";
import { RETAIL_PRICE } from "@/lib/products";
import { useCart } from "@/components/cart/cart-store";
import { perBox, discountPercent } from "@/lib/plan-pricing";

type Freq = 30 | 60 | 90;

interface PdpCtaBlockProps {
  product: ProductMeta;
}

export function PdpCtaBlock({ product }: PdpCtaBlockProps) {
  const t = useTranslations("pages.productos.cta");
  const [mode, setMode] = useState<"once" | "subscribe">("once");
  const [freq, setFreq] = useState<Freq>(30);

  const onceClick = () => {
    useCart.getState().addItem(product, RETAIL_PRICE);
    useCart.getState().openDrawer();
    setMode("once");
  };

  const subscribeClick = () => {
    if (mode !== "subscribe") {
      setMode("subscribe");
      return;
    }
    const price = perBox(freq);
    const discount = discountPercent(freq);
    useCart.getState().addItem(product, price, {
      interval_days: freq,
      discount_percentage: discount,
    });
    useCart.getState().openDrawer();
    setMode("once");
  };

  const minPerMonth = perBox(30);

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onceClick}
          className="inline-flex items-center gap-2 rounded-full bg-coral px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-coral/90"
        >
          {t("add", { price: RETAIL_PRICE })}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={subscribeClick}
          aria-pressed={mode === "subscribe"}
          className={
            mode === "subscribe"
              ? "inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-6 py-3 text-base font-semibold text-white"
              : "inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3 text-base font-semibold text-white hover:bg-white/10"
          }
        >
          {mode === "subscribe"
            ? t("subscribe_confirm", { days: freq, percent: discountPercent(freq) })
            : t("subscribe_from", { price: minPerMonth })}
        </button>
      </div>

      {/* Inline freq picker */}
      <div
        style={{
          maxHeight: mode === "subscribe" ? 200 : 0,
          overflow: "hidden",
          transition: "max-height 320ms cubic-bezier(0.22,1,0.36,1)",
        }}
        aria-hidden={mode !== "subscribe"}
      >
        <div className="mt-5 rounded-2xl border border-white/15 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
            {t("subscribe_freq_label")}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {([30, 60, 90] as const).map((f) => {
              const sel = f === freq;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFreq(f)}
                  aria-pressed={sel}
                  className={
                    sel
                      ? "rounded-xl bg-white px-3 py-3 text-center text-sm font-semibold text-navy"
                      : "rounded-xl bg-white/10 px-3 py-3 text-center text-sm font-semibold text-white/85 hover:bg-white/20"
                  }
                >
                  <div className="font-outfit text-base font-black">
                    {f}
                    <span className="text-xs font-semibold opacity-70">d</span>
                  </div>
                  <div
                    className="text-xs font-bold"
                    style={{ color: product.color }}
                  >
                    −{discountPercent(f)}%
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
