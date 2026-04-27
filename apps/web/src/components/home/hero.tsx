"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { NOVA_PRODUCTS, RETAIL_PRICE } from "@/lib/products";
import { useCart } from "@/components/cart/cart-store";
import { scrollToAnchor } from "@/lib/home-anchors";

export function Hero() {
  const t = useTranslations("pages.home.hero");
  const [selected, setSelected] = useState(2); // Glow default (popular)
  const [paused, setPaused] = useState(false);
  const product = NOVA_PRODUCTS[selected]!;

  useEffect(() => {
    if (paused) return;
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const id = setInterval(
      () => setSelected((s) => (s + 1) % NOVA_PRODUCTS.length),
      5500,
    );
    return () => clearInterval(id);
  }, [paused]);

  const handleSelect = (i: number) => {
    setPaused(true);
    setSelected(i);
  };

  const addPrimary = () => {
    useCart.getState().addItem(product, RETAIL_PRICE);
    useCart.getState().openDrawer();
  };

  const bg = `linear-gradient(160deg, ${product.ink} 0%, var(--navy) 75%)`;
  const glow = `radial-gradient(900px 600px at 75% 40%, ${product.color}55, transparent 60%)`;

  return (
    <section
      onFocus={() => setPaused(true)}
      style={{
        background: bg,
        transition: "background 700ms cubic-bezier(0.22,1,0.36,1)",
      }}
      className="relative min-h-[100svh] overflow-hidden pt-24 pb-16"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: glow }}
      />

      <div className="relative z-10 mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="inline-block rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-wider text-white/85">
            {t("pill", { name: product.name })}
          </span>
          <h1
            className="mt-5 font-outfit font-black leading-[0.95] text-white"
            style={{ fontSize: "clamp(40px, 11vw, 86px)" }}
          >
            {t("title_a")} <br />
            <span
              className="font-newsreader font-normal italic"
              style={{ color: product.color, transition: "color 700ms" }}
            >
              {t("title_b_italic")}
            </span>{" "}
            <br />
            {t("title_c")}
          </h1>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={addPrimary}
              className="bg-coral hover:bg-coral/90 inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold text-white"
            >
              {t("cta_primary", { name: product.name, price: RETAIL_PRICE })}
            </button>
            <button
              type="button"
              onClick={() => scrollToAnchor("products")}
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3 text-base font-semibold text-white hover:bg-white/10"
            >
              {t("cta_secondary")}
            </button>
          </div>
        </div>

        <div className="relative h-[440px] lg:h-[560px]">
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${product.color}66, transparent 65%)`,
              animation: "pulseHaloB 4s ease-in-out infinite",
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ animation: "floatPatchB 5s ease-in-out infinite" }}
          >
            <Image
              src={product.image}
              alt={product.name}
              priority
              fill
              sizes="(min-width:1024px) 50vw, 100vw"
              className="object-contain"
              style={{ filter: "drop-shadow(0 30px 60px rgba(0,0,0,0.4))" }}
            />
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-12">
        <p className="px-4 text-center text-xs uppercase tracking-wider text-white/70">
          {t("selector_label")}
        </p>
        <div className="mt-4 flex gap-3 overflow-x-auto px-4 [scroll-snap-type:x_mandatory] lg:justify-center lg:overflow-visible">
          {NOVA_PRODUCTS.map((p, i) => (
            <button
              key={p.slug}
              type="button"
              aria-pressed={i === selected}
              aria-label={`Mostrar parche ${p.name}`}
              onClick={() => handleSelect(i)}
              className={`shrink-0 rounded-2xl px-4 py-3 text-sm transition [scroll-snap-align:center] ${
                i === selected
                  ? "text-navy bg-white"
                  : "bg-white/10 text-white/80 hover:bg-white/20"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes pulseHaloB {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.06);
            opacity: 0.8;
          }
        }
        @keyframes floatPatchB {
          0%,
          100% {
            transform: translateY(0) rotate(0);
          }
          50% {
            transform: translateY(-14px) rotate(-2deg);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          :global(*) {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </section>
  );
}
