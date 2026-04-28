"use client";

import Image from "next/image";
import { useRouter, useParams } from "next/navigation";
import { Minus, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart, cartCount, cartTotal } from "@/components/cart/cart-store";
import { scrollToAnchor } from "@/lib/home-anchors";

export function CartDrawer() {
  const t = useTranslations("components.cart");
  const router      = useRouter();
  const params      = useParams();
  const locale      = typeof params.locale === "string" ? params.locale : "mx";
  const items       = useCart((s) => s.items);
  const open        = useCart((s) => s.drawerOpen);
  const openDrawer  = useCart((s) => s.openDrawer);
  const closeDrawer = useCart((s) => s.closeDrawer);
  const setQty      = useCart((s) => s.setQty);
  const removeItem  = useCart((s) => s.removeItem);
  const clear       = useCart((s) => s.clear);

  const setOpen = (v: boolean) => (v ? openDrawer() : closeDrawer());

  const count    = cartCount(items);
  const subtotal = cartTotal(items);
  const empty    = items.length === 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="flex w-full max-w-md flex-col bg-cream">
        <SheetHeader>
          <SheetTitle className="font-outfit text-2xl font-black text-navy">
            {t("drawer_title")}
            {!empty && ` · ${t("drawer_count", { count })}`}
          </SheetTitle>
        </SheetHeader>

        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-lg font-semibold text-navy">{t("empty_title")}</p>
            <Button
              onClick={() => {
                closeDrawer();
                scrollToAnchor("products");
              }}
              className="bg-coral text-white hover:bg-coral/90"
            >
              {t("empty_cta")}
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 space-y-2 overflow-y-auto px-2 py-4">
              {items.map((it) => (
                <li
                  key={it.slug}
                  className="flex items-center gap-3 rounded-2xl bg-white/60 p-3"
                >
                  <div
                    className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg"
                    style={{ background: it.color + "22" }}
                  >
                    <Image
                      src={it.image}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-contain"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-outfit font-black text-navy">{it.name}</p>
                      <button
                        type="button"
                        aria-label={t("remove_item", { name: it.name })}
                        onClick={() => removeItem(it.slug)}
                        className="text-navy/60 hover:text-coral"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-sm text-navy/70">${it.price} MXN</p>
                    {it.subscription && (
                      <p
                        className="mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                        style={{ background: it.color }}
                      >
                        {t("subscription_badge", {
                          interval: it.subscription.interval_days,
                          discount: it.subscription.discount_percentage,
                        })}
                      </p>
                    )}
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-navy/10 bg-white px-1">
                      <button
                        type="button"
                        aria-label="−"
                        onClick={() => setQty(it.slug, it.qty - 1)}
                        className="grid h-7 w-7 place-items-center rounded-full hover:bg-navy/5"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span
                        aria-label={t("qty_label", { name: it.name })}
                        className="min-w-6 text-center text-sm font-semibold"
                      >
                        {it.qty}
                      </span>
                      <button
                        type="button"
                        aria-label="+"
                        onClick={() => setQty(it.slug, it.qty + 1)}
                        className="grid h-7 w-7 place-items-center rounded-full hover:bg-navy/5"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-navy/10 px-4 py-4">
              <div className="flex items-center justify-between text-sm text-navy/70">
                <span>{t("shipping")}</span>
                <span>{t("shipping_later")}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-lg">
                <span className="font-semibold text-navy">{t("subtotal")}</span>
                <span className="font-outfit font-black text-navy">
                  ${subtotal} MXN
                </span>
              </div>
              <Button
                onClick={() => {
                  closeDrawer();
                  router.push(`/${locale}/checkout`);
                }}
                className="mt-4 w-full bg-coral text-white hover:bg-coral/90"
              >
                {t("checkout_cta")} →
              </Button>
              <button
                type="button"
                onClick={clear}
                className="mt-3 block w-full text-center text-sm text-navy/60 underline-offset-2 hover:text-coral hover:underline"
              >
                {t("clear")}
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
