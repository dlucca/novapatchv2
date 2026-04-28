"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { MX_STATES } from "@/lib/mx-states";
import { cartTotal } from "@/components/cart/cart-store";
import type { CartItem } from "@/components/cart/cart-store";

const SHIPPING_MXN = 85;

interface CheckoutFormProps {
  items: CartItem[];
  locale: string;
}

type Field = {
  name: string;
  email: string;
  phone: string;
  street: string;
  interior: string;
  colonia: string;
  cp: string;
  ciudad: string;
  estado: string;
};

const EMPTY: Field = {
  name: "", email: "", phone: "", street: "",
  interior: "", colonia: "", cp: "", ciudad: "", estado: "",
};

function validateFields(f: Field, t: (k: string) => string): Partial<Record<keyof Field, string>> {
  const e: Partial<Record<keyof Field, string>> = {};
  if (!f.name.trim()) e.name = t("err_required");
  if (!f.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = t("err_email");
  if (!/^\d{10}$/.test(f.phone.replace(/\D/g, ""))) e.phone = t("err_phone");
  if (!f.street.trim()) e.street = t("err_required");
  if (!f.colonia.trim()) e.colonia = t("err_required");
  if (!/^\d{5}$/.test(f.cp)) e.cp = t("err_cp");
  if (!f.ciudad.trim()) e.ciudad = t("err_required");
  if (!f.estado) e.estado = t("err_required");
  return e;
}

export function CheckoutForm({ items, locale }: CheckoutFormProps) {
  const t = useTranslations("components.checkout");
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();

  const [fields, setFields] = useState<Field>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Field, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);

  const total = cartTotal(items) + SHIPPING_MXN;

  const set = (k: keyof Field) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFields((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    const fieldErrors = validateFields(fields, t);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    setStripeError(null);

    const returnUrl = `${window.location.origin}/${locale}/checkout/exito`;

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
        payment_method_data: {
          billing_details: {
            name: fields.name,
            email: fields.email,
            phone: fields.phone,
            address: {
              line1: fields.street,
              line2: [fields.interior, fields.colonia].filter(Boolean).join(", "),
              postal_code: fields.cp,
              city: fields.ciudad,
              state: fields.estado,
              country: "MX",
            },
          },
        },
      },
    });

    if (error) {
      setStripeError(error.message ?? "Error desconocido");
      setSubmitting(false);
    }
    // On success Stripe redirects to return_url — no need to navigate here.
  };

  const inputCls =
    "w-full rounded-xl border border-navy/20 bg-white px-4 py-2.5 text-sm text-navy placeholder:text-navy/40 focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/20";
  const labelCls = "block text-xs font-semibold uppercase tracking-wider text-navy/60 mb-1";
  const errorCls = "mt-1 text-xs text-red-500";

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      {/* Contact */}
      <section>
        <h2 className="font-outfit text-base font-black text-navy mb-4">{t("section_contact")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>{t("name_label")}</label>
            <input className={inputCls} type="text" autoComplete="name" value={fields.name} onChange={set("name")} />
            {errors.name && <p className={errorCls}>{errors.name}</p>}
          </div>
          <div>
            <label className={labelCls}>{t("email_label")}</label>
            <input className={inputCls} type="email" autoComplete="email" value={fields.email} onChange={set("email")} />
            {errors.email && <p className={errorCls}>{errors.email}</p>}
          </div>
          <div>
            <label className={labelCls}>{t("phone_label")}</label>
            <input className={inputCls} type="tel" autoComplete="tel" inputMode="numeric" maxLength={10} value={fields.phone} onChange={set("phone")} />
            {errors.phone && <p className={errorCls}>{errors.phone}</p>}
          </div>
        </div>
      </section>

      {/* Address */}
      <section>
        <h2 className="font-outfit text-base font-black text-navy mb-4">{t("section_shipping")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>{t("street_label")}</label>
            <input className={inputCls} type="text" autoComplete="address-line1" value={fields.street} onChange={set("street")} />
            {errors.street && <p className={errorCls}>{errors.street}</p>}
          </div>
          <div>
            <label className={labelCls}>{t("interior_label")}</label>
            <input className={inputCls} type="text" autoComplete="address-line2" value={fields.interior} onChange={set("interior")} />
          </div>
          <div>
            <label className={labelCls}>{t("colonia_label")}</label>
            <input className={inputCls} type="text" value={fields.colonia} onChange={set("colonia")} />
            {errors.colonia && <p className={errorCls}>{errors.colonia}</p>}
          </div>
          <div>
            <label className={labelCls}>{t("cp_label")}</label>
            <input className={inputCls} type="text" autoComplete="postal-code" inputMode="numeric" maxLength={5} value={fields.cp} onChange={set("cp")} />
            {errors.cp && <p className={errorCls}>{errors.cp}</p>}
          </div>
          <div>
            <label className={labelCls}>{t("ciudad_label")}</label>
            <input className={inputCls} type="text" autoComplete="address-level2" value={fields.ciudad} onChange={set("ciudad")} />
            {errors.ciudad && <p className={errorCls}>{errors.ciudad}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>{t("estado_label")}</label>
            <select className={inputCls} autoComplete="address-level1" value={fields.estado} onChange={set("estado")}>
              <option value="">{t("estado_placeholder")}</option>
              {MX_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {errors.estado && <p className={errorCls}>{errors.estado}</p>}
          </div>
        </div>
      </section>

      {/* Payment */}
      <section>
        <h2 className="font-outfit text-base font-black text-navy mb-4">{t("section_payment")}</h2>
        <PaymentElement
          options={{
            layout: "tabs",
            fields: { billingDetails: { name: "never", email: "never", phone: "never", address: "never" } },
          }}
        />
        {stripeError && (
          <p className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{stripeError}</p>
        )}
      </section>

      <button
        type="submit"
        disabled={submitting || !stripe || !elements}
        className="w-full rounded-full bg-coral px-6 py-4 font-outfit text-base font-black text-white hover:bg-coral/90 disabled:opacity-60 transition-opacity"
      >
        {submitting ? t("processing") : t("cta", { amount: total })}
      </button>
    </form>
  );
}
