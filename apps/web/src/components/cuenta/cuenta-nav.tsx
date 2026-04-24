"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

interface CuentaNavProps {
  locale: string;
}

export function CuentaNav({ locale }: CuentaNavProps) {
  const t = useTranslations("cuenta.nav");
  const pathname = usePathname();
  const base = `/${locale}/cuenta`;

  const items = [
    { href: base, label: t("perfil") },
    { href: `${base}/suscripciones`, label: t("suscripciones") },
    { href: `${base}/pedidos`, label: t("pedidos") },
  ];

  return (
    <nav className="flex gap-4 border-b border-gray-200 pb-2">
      {items.map((item) => {
        const isActive =
          item.href === base ? pathname === base : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              isActive
                ? "text-sm font-semibold underline underline-offset-4"
                : "text-sm text-muted-foreground hover:underline"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
