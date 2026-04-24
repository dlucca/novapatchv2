import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { Order } from "@/lib/api";
import { toBcp47 } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { StatusBadge } from "./status-badge";

function shortId(id: string): string {
  return id.slice(0, 8);
}

export async function OrdersList({
  orders,
  locale,
}: {
  orders: Order[];
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "cuenta.orders" });
  const bcp = toBcp47(locale);

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
        <Link
          href={`/${locale}/tienda`}
          className="text-sm underline underline-offset-4"
        >
          Ver tienda
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {orders.map((o) => (
        <Card key={o.id}>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">
                {t("order_label", { id: shortId(o.id) })}
              </CardTitle>
              <CardDescription>{formatDate(o.createdAt, bcp)}</CardDescription>
            </div>
            <StatusBadge status={o.status} />
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="flex flex-col gap-1">
              {o.items.map((it, idx) => (
                <li key={idx} className="flex justify-between">
                  <span>
                    {it.name} × {it.quantity}
                    {it.isSubscription && it.intervalDays !== null ? (
                      <span className="text-muted-foreground ml-2">
                        ({t("subscription_chip", { days: it.intervalDays })})
                      </span>
                    ) : null}
                  </span>
                  <span>
                    {formatMoney(it.unitPrice * it.quantity, o.currency, bcp)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter className="flex flex-col gap-1 text-sm">
            <Row label={t("subtotal")} value={formatMoney(o.subtotal, o.currency, bcp)} />
            {o.discountAmount > 0 ? (
              <Row
                label={t("discount")}
                value={`- ${formatMoney(o.discountAmount, o.currency, bcp)}`}
              />
            ) : null}
            <Row label={t("tax")} value={formatMoney(o.tax, o.currency, bcp)} />
            <Row label={t("shipping")} value={formatMoney(o.shipping, o.currency, bcp)} />
            <Row
              label={t("total")}
              value={formatMoney(o.total, o.currency, bcp)}
              bold
            />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex w-full justify-between ${
        bold ? "font-semibold" : "text-muted-foreground"
      }`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
