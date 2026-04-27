"use client";

import { useTranslations } from "next-intl";

const KEYS = ["1", "2", "3", "4"] as const;

export function TrustStrip() {
  const t = useTranslations("pages.suscripciones.trust");
  return (
    <div className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-4 md:grid-cols-4">
      {KEYS.map((k) => (
        <div
          key={k}
          className="rounded-2xl border border-navy/5 bg-white p-4 text-center shadow-sm"
        >
          <p className="font-outfit text-sm font-bold text-navy">
            {t(`${k}_t`)}
          </p>
          <p className="mt-1 text-[11.5px] leading-snug text-navy/60">
            {t(`${k}_d`)}
          </p>
        </div>
      ))}
    </div>
  );
}
