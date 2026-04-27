"use client";

import { useTranslations } from "next-intl";
import { scrollToAnchor } from "@/lib/home-anchors";

const STATS = ["size", "duration", "digestion"] as const;

const LAYERS = [
  { key: "corneo",    height: 76,  bg: "#F4E4D6", text: "#7A5848" },
  { key: "epidermis", height: 92,  bg: "#E8D5C0", text: "#7A5848" },
  { key: "dermis",    height: 124, bg: "#D4B5A0", text: "#5C3F30" },
  { key: "blood",     height: 80,  bg: "#A85A4A", text: "#FFFFFF" },
] as const;

export function Absorption() {
  const t = useTranslations("pages.home.absorption");
  return (
    <section id="ciencia" className="bg-[var(--color-blush)] py-20">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 lg:grid-cols-[1fr_1.25fr] lg:items-center">
        <div>
          <span className="text-xs uppercase tracking-wider text-coral">{t("eyebrow")}</span>
          <h2 className="mt-3 font-outfit text-4xl font-black leading-tight text-navy lg:text-5xl">
            {t("title")}
          </h2>
          <p className="mt-5 text-base text-navy/70">{t("lead")}</p>

          <div className="mt-8 flex gap-3 overflow-x-auto pb-2 [scroll-snap-type:x_mandatory] lg:flex-wrap lg:overflow-visible">
            {STATS.map((k) => (
              <div
                key={k}
                className="min-w-[130px] shrink-0 [scroll-snap-align:start] rounded-2xl bg-white p-4 shadow-sm"
              >
                <div className="font-outfit text-3xl font-black text-navy">
                  {t(`stats.${k}.value`)}{" "}
                  <span className="text-base text-navy/60">{t(`stats.${k}.unit`)}</span>
                </div>
                <p className="text-xs text-navy/70">{t(`stats.${k}.label`)}</p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => scrollToAnchor("products")}
            className="mt-8 inline-flex rounded-full bg-coral px-6 py-3 text-base font-semibold text-white hover:bg-coral/90"
          >
            {t("cta")}
          </button>
        </div>

        <SkinDiagramC />
      </div>
    </section>
  );
}

function SkinDiagramC() {
  const t = useTranslations("pages.home.absorption.diagram");
  const dots = [
    { l: 22, d: 0 },
    { l: 36, d: 0.6 },
    { l: 52, d: 1.4 },
    { l: 68, d: 2.2 },
    { l: 82, d: 3.1 },
    { l: 44, d: 4.0 },
  ];

  return (
    <div className="relative max-w-[580px] rounded-3xl bg-[#EFE0D6] p-[18px]">
      <div className="rounded-full bg-[var(--color-gold)] px-4 py-2 text-center font-outfit text-sm font-black uppercase tracking-wide text-navy">
        {t("novapatch_label")}
      </div>
      <p className="mt-1 text-center text-xs text-navy/70">{t("novapatch_subtitle")}</p>

      <div className="relative mt-4 h-[372px] overflow-hidden rounded-2xl">
        {/* 4 stacked bands with wavy bottoms via border-radius */}
        <div className="absolute inset-x-0 top-0 flex flex-col">
          {LAYERS.map((layer, idx) => {
            const isLast = idx === LAYERS.length - 1;
            return (
              <div
                key={layer.key}
                className="relative w-full"
                style={{
                  height: `${layer.height}px`,
                  background: layer.bg,
                  color: layer.text,
                  borderBottomLeftRadius: isLast ? 0 : "50% 18px",
                  borderBottomRightRadius: isLast ? 0 : "50% 18px",
                  marginBottom: isLast ? 0 : "-10px",
                  zIndex: LAYERS.length - idx,
                }}
              >
                <span
                  className="absolute left-3 top-2 font-outfit text-[10px] font-black uppercase tracking-wider"
                  style={{ color: layer.text }}
                >
                  {t(`layers.${layer.key}`)}
                </span>
                {layer.key === "blood" ? (
                  <svg
                    className="absolute inset-0 h-full w-full"
                    viewBox="0 0 580 80"
                    preserveAspectRatio="none"
                    aria-hidden
                  >
                    <path
                      d="M 0 40 Q 145 10 290 40 T 580 40"
                      fill="none"
                      stroke="#FF6B5B"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 0 55 Q 145 80 290 55 T 580 55"
                      fill="none"
                      stroke="#7A2A1F"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : null}
              </div>
            );
          })}
        </div>

        {dots.map((d, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute top-0 h-2 w-2 rounded-full bg-[var(--color-coral)]"
            style={{ left: `${d.l}%`, animation: `nc-descend-c 5s linear ${d.d}s infinite` }}
          />
        ))}
      </div>

      <span className="absolute bottom-2 right-3 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-navy">
        {t("chip_daltons")}
      </span>

      <style jsx>{`
        @keyframes nc-descend-c {
          0%   { transform: translateY(0);   opacity: 1 }
          80%  { transform: translateY(330px); opacity: 1 }
          100% { transform: translateY(360px); opacity: 0 }
        }
        @media (prefers-reduced-motion: reduce) {
          span[aria-hidden] {
            animation-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
}
