"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { toast } from "sonner";
import { submitWaitlist } from "@/lib/api-client";
import { ApiError } from "@/lib/api";
import { getCookie } from "@/lib/cookies";

const COLUMNS = [
  { key: "shop", links: ["store", "subs", "warranty"] },
  { key: "help", links: ["contact", "faq", "refund"] },
  { key: "about", links: ["us", "why", "subscribe"] },
  { key: "legal", links: ["privacy", "terms"] },
] as const;

// Only "subscribe" has a real (anchor) destination today.
const ENABLED_LINKS = new Set<string>(["about.subscribe"]);
const linkHref = (col: string, key: string): string =>
  col === "about" && key === "subscribe" ? "#productos" : "#";

export function validateEmail(raw: string): string | null {
  const cleaned = raw.trim().toLowerCase();
  const parsed = z.string().email().max(255).safeParse(cleaned);
  return parsed.success ? cleaned : null;
}

export function Footer() {
  const t = useTranslations("components.footer");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const cleaned = validateEmail(email);
    if (!cleaned) {
      toast.error(t("newsletter.error_invalid"));
      return;
    }
    const country = (getCookie("country") ?? "MX").toUpperCase();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      toast.error(t("newsletter.error_generic"));
      return;
    }
    setBusy(true);
    try {
      await submitWaitlist({ apiUrl, email: cleaned, country, source: "footer" });
      toast.success(t("newsletter.success"));
      setEmail("");
    } catch (err) {
      if (err instanceof ApiError && err.code === "invalid_input") {
        toast.error(t("newsletter.error_invalid"));
      } else {
        toast.error(t("newsletter.error_generic"));
      }
    } finally {
      setBusy(false);
    }
  };

  const year = new Date().getFullYear();

  return (
    <footer className="bg-[var(--cream-warm)] py-16">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-2 lg:grid-cols-[repeat(4,1fr)_1.4fr]">
        {COLUMNS.map((col) => (
          <div key={col.key}>
            <h4 className="font-outfit text-sm font-black uppercase tracking-wider text-navy">
              {t(`columns.${col.key}.title`)}
            </h4>
            <ul className="mt-4 space-y-2 text-sm">
              {col.links.map((lk) => {
                const enabled = ENABLED_LINKS.has(`${col.key}.${lk}`);
                const disabledProps = !enabled
                  ? { "aria-disabled": "true" as const, title: t("coming_soon") }
                  : {};
                return (
                  <li key={lk}>
                    <a
                      href={linkHref(col.key, lk)}
                      {...disabledProps}
                      className={
                        enabled
                          ? "text-navy/80 hover:text-coral"
                          : "pointer-events-none text-navy/50 opacity-60"
                      }
                    >
                      {t(`columns.${col.key}.links.${lk}`)}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <form onSubmit={onSubmit} className="md:col-span-2 lg:col-span-1">
          <h4 className="font-outfit text-sm font-black uppercase tracking-wider text-navy">
            {t("newsletter.title")}
          </h4>
          <p className="mt-2 text-sm text-navy/70">{t("newsletter.lead")}</p>
          <div className="mt-3 flex gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("newsletter.placeholder")}
              className="flex-1 rounded-full border border-navy/10 bg-white px-4 py-2 text-sm text-navy focus:border-coral focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white hover:bg-coral/90 disabled:opacity-60"
            >
              {t("newsletter.submit")}
            </button>
          </div>
        </form>
      </div>

      <div className="mx-auto mt-12 flex max-w-6xl items-center justify-between border-t border-navy/10 px-4 pt-6 text-xs text-navy/60">
        <span>{t("rights", { year, tagline: t("tagline") })}</span>
        <span>Hecho en México</span>
      </div>
    </footer>
  );
}
