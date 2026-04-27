"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { routing } from "@/i18n/routing";
import { setCookie } from "@/lib/cookies";

const LOCALE_LABELS: Record<string, { flag: string; name: string }> = {
  mx: { flag: "🇲🇽", name: "México" },
  ar: { flag: "🇦🇷", name: "Argentina" },
  br: { flag: "🇧🇷", name: "Brasil" },
  cl: { flag: "🇨🇱", name: "Chile" },
  co: { flag: "🇨🇴", name: "Colombia" },
};

interface CountrySelectorProps {
  /** When true, renders the long form ("🇲🇽 México") suitable for mobile menu rows. */
  expanded?: boolean;
}

export function CountrySelector({ expanded = false }: CountrySelectorProps) {
  const t = useTranslations("site.country_selector");
  const currentLocale = useLocale();
  const pathname = usePathname();
  const locales = routing.locales as readonly string[];
  const current = LOCALE_LABELS[currentLocale] ?? LOCALE_LABELS.mx!;

  function handleSelect(nextLocale: string) {
    if (nextLocale === currentLocale) return;
    setCookie("country", nextLocale);
    // Replace the leading /<oldLocale> with /<newLocale>; preserve the rest.
    const rest = pathname.replace(new RegExp(`^/${currentLocale}(?=/|$)`), "") || "/";
    const target = `/${nextLocale}${rest === "/" ? "" : rest}`;
    window.location.assign(target);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("current_aria", { country: current.name })}
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-body-sm font-medium text-navy/70 hover:text-navy hover:bg-navy/5 transition-colors"
      >
        <span aria-hidden>{current.flag}</span>
        {expanded ? <span>{current.name}</span> : null}
        <ChevronDown className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((loc) => {
          const label = LOCALE_LABELS[loc] ?? { flag: "🌐", name: loc.toUpperCase() };
          return (
            <DropdownMenuItem
              key={loc}
              onSelect={() => handleSelect(loc)}
              className={loc === currentLocale ? "font-semibold" : ""}
            >
              <span aria-hidden className="mr-2">{label.flag}</span>
              {label.name}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
