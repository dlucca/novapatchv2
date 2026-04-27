"use client";

import Image from "next/image";
import type { ProductMeta } from "@/lib/products";
import type { ProductContent } from "@/lib/products-content";
import { PdpCtaBlock } from "@/components/pdp/pdp-cta-block";

interface PdpHeroProps {
  product: ProductMeta;
  content: ProductContent["hero"];
}

export function PdpHero({ product, content }: PdpHeroProps) {
  const bg = `linear-gradient(160deg, ${product.ink} 0%, var(--color-navy) 75%)`;
  const halo = `radial-gradient(900px 600px at 75% 40%, ${product.color}55, transparent 60%)`;

  return (
    <section
      style={{ background: bg }}
      className="relative min-h-[80svh] overflow-hidden pt-24 pb-16"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: halo }}
      />

      <div className="relative z-10 mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="inline-block rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-wider text-white/85">
            {content.eyebrow}
          </span>
          <h1
            className="mt-5 font-outfit font-black leading-[0.98] text-white"
            style={{ fontSize: "clamp(40px, 9vw, 72px)" }}
          >
            {content.headline}
          </h1>
          <p
            className="mt-4 font-newsreader italic font-normal text-2xl lg:text-3xl"
            style={{ color: product.color }}
          >
            {content.subhead}
          </p>
          <PdpCtaBlock product={product} />
        </div>

        <div className="relative h-[420px] lg:h-[560px]">
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${product.color}66, transparent 65%)`,
              animation: "pulseHaloPdp 4s ease-in-out infinite",
            }}
          />
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

      <style jsx>{`
        @keyframes pulseHaloPdp {
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
      `}</style>
    </section>
  );
}
