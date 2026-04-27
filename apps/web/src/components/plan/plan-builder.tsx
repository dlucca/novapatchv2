"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { NOVA_PRODUCTS } from "@/lib/products";
import {
  perBox,
  monthly as monthlyTotal,
  saved as savedTotal,
  discountPercent,
  type Freq,
} from "@/lib/plan-pricing";
import { useCart } from "@/components/cart/cart-store";
import { PlanCard } from "@/components/plan/plan-card";
import { PlanLegend } from "@/components/plan/plan-legend";
import { PlanBottomBar, type ActiveItem } from "@/components/plan/plan-bottom-bar";
import { TrustStrip } from "@/components/plan/trust-strip";

type State = Record<string, { active: boolean; freq: Freq }>;

interface PlanBuilderProps {
  locale: string;
}

export function PlanBuilder({ locale }: PlanBuilderProps) {
  const t = useTranslations("pages.suscripciones");
  const [plan, setPlan] = useState<State>({});
  const [drawerOpen, setDrawerOpen] = useState(false);

  const togglePlan = (slug: string) => {
    setPlan((p) => {
      const ex = p[slug];
      if (ex && ex.active) return { ...p, [slug]: { ...ex, active: false } };
      return { ...p, [slug]: { active: true, freq: 30 } };
    });
  };
  const setFreq = (slug: string, freq: Freq) => {
    setPlan((p) => ({ ...p, [slug]: { active: true, freq } }));
  };

  const items = useMemo<ActiveItem[]>(
    () =>
      NOVA_PRODUCTS
        .map((p) => {
          const s = plan[p.slug];
          return s && s.active ? { p, freq: s.freq } : null;
        })
        .filter((x): x is ActiveItem => x !== null),
    [plan],
  );

  const monthly = useMemo(
    () => monthlyTotal(items.map((it) => ({ slug: it.p.slug, freq: it.freq }))),
    [items],
  );
  const saved = useMemo(
    () => savedTotal(items.map((it) => ({ slug: it.p.slug, freq: it.freq }))),
    [items],
  );

  const handleSubscribe = () => {
    const { addItem, openDrawer } = useCart.getState();
    items.forEach((it) => {
      addItem(it.p, perBox(it.freq), {
        interval_days: it.freq,
        discount_percentage: discountPercent(it.freq),
      });
    });
    openDrawer();
  };

  const empty = items.length === 0;

  return (
    <>
      <section
        className="px-6 pb-[200px] pt-20"
        style={{ background: "var(--color-cream, #FAF7F2)" }}
      >
        <div className="mx-auto max-w-[720px]">
          {/* Header */}
          <div className="mb-10">
            <Link
              href={`/${locale}`}
              className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-navy/60 hover:text-coral"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("header.back")}
            </Link>
            <p className="text-xs font-bold uppercase tracking-widest text-coral">
              {t("header.eyebrow")}
            </p>
            <h1 className="mt-3 font-outfit text-4xl font-black leading-tight tracking-tight text-navy md:text-5xl">
              {t("header.title_a")}{" "}
              <span className="font-newsreader font-normal italic text-[var(--color-gold)]">
                {t("header.title_b_italic")}
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-navy/75">
              {t.rich("header.lead", {
                strong: (chunks) => (
                  <strong className="font-bold text-navy">{chunks}</strong>
                ),
              })}
            </p>
          </div>

          <PlanLegend />

          {/* Step indicator */}
          <div className="mb-4 flex items-center gap-2.5 text-navy/55">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-navy font-outfit text-xs font-extrabold text-white">
              1
            </span>
            <span className="text-[13px] font-semibold tracking-wide">
              {t("step1_title")}
            </span>
          </div>

          {/* Cards stack */}
          <div className="mb-3 grid gap-4">
            {NOVA_PRODUCTS.map((p) => {
              const s = plan[p.slug] ?? { active: false, freq: 30 as Freq };
              return (
                <PlanCard
                  key={p.slug}
                  p={p}
                  active={s.active}
                  freq={s.freq}
                  onToggle={() => togglePlan(p.slug)}
                  onFreqChange={(f) => setFreq(p.slug, f)}
                />
              );
            })}
          </div>

          {empty && (
            <div
              className="mt-8 rounded-2xl px-6 py-5 text-center text-sm leading-relaxed text-navy/70"
              style={{
                background: "rgba(28,177,188,0.1)",
                border: "1px dashed rgba(28,177,188,0.4)",
              }}
            >
              {t.rich("empty_helper", {
                strong: (chunks) => (
                  <strong className="font-bold text-navy">{chunks}</strong>
                ),
              })}
            </div>
          )}

          <TrustStrip />
        </div>
      </section>

      <PlanBottomBar
        items={items}
        monthly={monthly}
        saved={saved}
        open={drawerOpen}
        onToggle={() => setDrawerOpen((v) => !v)}
        onSubscribe={handleSubscribe}
      />
    </>
  );
}
