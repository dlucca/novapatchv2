"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Elements } from "@stripe/react-stripe-js";
import { useTranslations } from "next-intl";
import { useCart, cartTotal } from "@/components/cart/cart-store";
import { getStripePromise } from "@/lib/stripe-client";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { OrderSummary } from "@/components/checkout/order-summary";

const stripePromise = getStripePromise();

export default function CheckoutPage() {
  const t = useTranslations("components.checkout");
  const params = useParams();
  const locale = typeof params.locale === "string" ? params.locale : "mx";
  const router = useRouter();

  const items = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [piError, setPiError] = useState<string | null>(null);

  // Redirect if cart is empty (after hydration).
  useEffect(() => {
    if (hydrated && items.length === 0) {
      router.replace(`/${locale}/tienda`);
    }
  }, [hydrated, items.length, locale, router]);

  // Create PaymentIntent once cart is known.
  useEffect(() => {
    if (!hydrated || items.length === 0) return;
    const subtotal = cartTotal(items);

    fetch("/api/checkout/payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount_mxn: subtotal, items }),
    })
      .then(async (res) => {
        const data = (await res.json()) as { clientSecret?: string; error?: string };
        if (!res.ok || !data.clientSecret) throw new Error(data.error ?? "Error creando pago");
        setClientSecret(data.clientSecret);
      })
      .catch((err: unknown) => {
        setPiError(err instanceof Error ? err.message : "Error desconocido");
      });
  }, [hydrated, items]);

  if (!hydrated || (!clientSecret && !piError)) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-navy/20 border-t-coral" />
      </main>
    );
  }

  if (piError) {
    return (
      <main className="min-h-screen bg-cream flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-navy font-semibold">{piError}</p>
        <Link href={`/${locale}/tienda`} className="text-coral underline underline-offset-2">
          {t("empty_cta")}
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream pt-24 pb-20">
      <div className="mx-auto max-w-5xl px-4">
        <Link
          href={`/${locale}/tienda`}
          className="mb-8 inline-block text-sm text-navy/60 hover:text-navy"
        >
          {t("back")}
        </Link>
        <h1 className="font-outfit text-3xl font-black text-navy mb-10">{t("title")}</h1>

        <div className="grid gap-10 lg:grid-cols-[1fr_380px] lg:items-start">
          {/* Form column */}
          <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-navy/10 lg:p-8">
            {clientSecret && (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: "stripe",
                    variables: {
                      colorPrimary: "#E8503A",
                      colorBackground: "#ffffff",
                      colorText: "#0D1B35",
                      colorDanger: "#ef4444",
                      borderRadius: "12px",
                      fontFamily: "Outfit, system-ui, sans-serif",
                    },
                  },
                  locale: "es-419",
                }}
              >
                <CheckoutForm items={items} locale={locale} />
              </Elements>
            )}
          </div>

          {/* Summary column */}
          <div className="lg:sticky lg:top-28">
            <OrderSummary items={items} />
          </div>
        </div>
      </div>
    </main>
  );
}
