"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Subscription } from "@/lib/api";
import { SubscriptionCard } from "./subscription-card";

export function SubscriptionsList({
  subscriptions,
  locale,
  apiUrl,
}: {
  subscriptions: Subscription[];
  locale: string;
  apiUrl: string;
}) {
  const t = useTranslations("cuenta.subscriptions");

  if (subscriptions.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
        <Link
          href={`/${locale}/tienda`}
          className="text-sm underline underline-offset-4"
        >
          {t("shop_cta")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {subscriptions.map((s) => (
        <SubscriptionCard key={s.id} sub={s} locale={locale} apiUrl={apiUrl} />
      ))}
    </div>
  );
}
