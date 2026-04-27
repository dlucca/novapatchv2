"use client";

import { ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCart, cartCount } from "@/components/cart/cart-store";

type Variant = "transparent" | "default";

interface CartButtonProps {
  variant?: Variant;
  className?: string;
}

export function CartButton({ variant = "default", className = "" }: CartButtonProps) {
  const t = useTranslations("components.cart");
  const items    = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);
  const open     = useCart((s) => s.openDrawer);
  const count    = hydrated ? cartCount(items) : 0;

  const tone =
    variant === "transparent"
      ? "text-white hover:bg-white/10"
      : "text-navy hover:bg-navy/5";

  return (
    <button
      type="button"
      onClick={open}
      aria-label={t("button_aria", { count })}
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full transition ${tone} ${className}`}
    >
      <ShoppingBag className="h-5 w-5" aria-hidden />
      {hydrated && count > 0 && (
        <span
          data-testid="cart-count"
          className="absolute -top-1 -right-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1 text-[11px] font-bold text-white"
        >
          {count}
        </span>
      )}
    </button>
  );
}
