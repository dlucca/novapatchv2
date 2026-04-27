"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import type { ProductMeta } from "@/lib/products";
import { RETAIL_PRICE } from "@/lib/products";
import { useCart } from "@/components/cart/cart-store";

interface PdpStickyCtaProps {
  product: ProductMeta;
  /** id of the element to observe — when offscreen, sticky shows. */
  observeTargetId: string;
}

export function PdpStickyCta({ product, observeTargetId }: PdpStickyCtaProps) {
  const t = useTranslations("pages.productos");
  const [visible, setVisible] = useState(false);
  const target = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = document.getElementById(observeTargetId);
    if (!el) return;
    target.current = el;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        setVisible(!entry.isIntersecting);
      },
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [observeTargetId]);

  const onAdd = () => {
    useCart.getState().addItem(product, RETAIL_PRICE);
    useCart.getState().openDrawer();
  };

  return (
    <div
      aria-hidden={!visible}
      className="md:hidden"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        padding: "12px 16px calc(12px + env(safe-area-inset-bottom))",
        transform: visible ? "translateY(0)" : "translateY(110%)",
        transition: "transform 250ms cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      <div className="flex items-center gap-3 rounded-full bg-white p-2 pl-3 shadow-[0_18px_48px_rgba(13,27,53,0.18)]">
        <div
          className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full"
          style={{ background: product.bg }}
        >
          <Image
            src={product.image}
            alt=""
            fill
            sizes="40px"
            className="object-contain"
          />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-navy">{product.name}</p>
          <p className="text-xs text-navy/60">${RETAIL_PRICE} MXN</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white"
        >
          {t("sticky_cta.add")}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
