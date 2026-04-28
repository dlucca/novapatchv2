"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { cartTotal } from "@/components/cart/cart-store";
import type { CartItem } from "@/components/cart/cart-store";

const SHIPPING_MXN = 85;

interface OrderSummaryProps {
  items: CartItem[];
}

export function OrderSummary({ items }: OrderSummaryProps) {
  const t = useTranslations("components.checkout");
  const subtotal = cartTotal(items);
  const total = subtotal + SHIPPING_MXN;

  return (
    <div className="rounded-3xl bg-white/60 p-6 ring-1 ring-navy/10">
      <h2 className="font-outfit text-lg font-black text-navy">{t("order_summary")}</h2>

      <ul className="mt-4 space-y-3">
        {items.map((it) => (
          <li key={`${it.slug}-${it.subscription?.interval_days ?? "once"}`} className="flex items-center gap-3">
            <div
              className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl"
              style={{ background: it.color + "22" }}
            >
              <Image src={it.image} alt={it.name} fill sizes="56px" className="object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-outfit font-bold text-navy leading-tight truncate">{it.name}</p>
              {it.subscription && (
                <p
                  className="mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                  style={{ background: it.color }}
                >
                  {t("subscription_badge", {
                    interval: it.subscription.interval_days,
                    discount: it.subscription.discount_percentage,
                  })}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="font-outfit font-black text-navy text-sm">${it.price * it.qty}</p>
              {it.qty > 1 && (
                <p className="text-xs text-navy/50">{it.qty} × ${it.price}</p>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-5 space-y-2 border-t border-navy/10 pt-4 text-sm">
        <div className="flex justify-between text-navy/70">
          <span>{t("subtotal")}</span>
          <span>${subtotal} MXN</span>
        </div>
        <div className="flex justify-between text-navy/70">
          <span>{t("shipping")}</span>
          <span>{t("shipping_value")}</span>
        </div>
        <div className="flex justify-between text-base font-black text-navy pt-2 border-t border-navy/10">
          <span>{t("total")}</span>
          <span>${total} MXN</span>
        </div>
      </div>
    </div>
  );
}
