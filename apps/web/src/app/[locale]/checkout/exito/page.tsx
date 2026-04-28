"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { loadStripe } from "@stripe/stripe-js";
import { useCart } from "@/components/cart/cart-store";

export default function CheckoutSuccessPage() {
  const t = useTranslations("components.checkout_success");
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = typeof params.locale === "string" ? params.locale : "mx";

  const clear = useCart((s) => s.clear);

  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [paymentId, setPaymentId] = useState<string | null>(null);

  useEffect(() => {
    const clientSecret = searchParams.get("payment_intent_client_secret");
    if (!clientSecret) {
      setStatus("failed");
      return;
    }

    const pk = process.env.NEXT_PUBLIC_STRIPE_PK;
    if (!pk) { setStatus("failed"); return; }

    loadStripe(pk).then(async (stripe) => {
      if (!stripe) { setStatus("failed"); return; }
      const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);
      if (paymentIntent?.status === "succeeded") {
        setPaymentId(paymentIntent.id);
        setStatus("success");
        clear();
      } else {
        setStatus("failed");
      }
    }).catch(() => setStatus("failed"));
  }, [searchParams, clear]);

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-navy/20 border-t-coral" />
      </main>
    );
  }

  if (status === "failed") {
    return (
      <main className="min-h-screen bg-cream flex flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="text-5xl">⚠️</div>
        <p className="font-outfit text-xl font-black text-navy">No pudimos confirmar tu pago</p>
        <p className="text-navy/60 max-w-sm">
          Si el cargo ya fue aplicado, espera unos minutos y revisa tu correo. Si el problema persiste, contáctanos.
        </p>
        <Link
          href={`/${locale}/tienda`}
          className="rounded-full bg-coral px-6 py-3 font-semibold text-white hover:bg-coral/90"
        >
          {t("cta")}
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream flex flex-col items-center justify-center gap-6 px-4 text-center">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full text-4xl"
        style={{ background: "var(--color-teal)" }}
      >
        ✓
      </div>
      <h1 className="font-outfit text-3xl font-black text-navy">{t("title")}</h1>
      <p className="max-w-sm text-navy/70">{t("lead")}</p>
      {paymentId && (
        <p className="rounded-full bg-navy/5 px-4 py-1.5 text-xs font-mono text-navy/50">
          {t("order_id", { id: paymentId.slice(-8).toUpperCase() })}
        </p>
      )}
      <Link
        href={`/${locale}/tienda`}
        className="rounded-full bg-coral px-6 py-3 font-semibold text-white hover:bg-coral/90"
      >
        {t("cta")}
      </Link>
    </main>
  );
}
