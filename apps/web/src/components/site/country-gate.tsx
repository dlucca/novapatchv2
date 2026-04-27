"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { routing } from "@/i18n/routing";
import { getCookie, setCookie } from "@/lib/cookies";
import { countryName } from "@/lib/country-names";
import { submitWaitlist } from "@/lib/api-client";

const COUNTRY_COOKIE = "country";
const SUPPORTED_LOCALES = routing.locales as readonly string[];
const NEUTRAL_COOKIE_VALUES = new Set(["unknown", "dismissed"]);

const EmailSchema = z.string().email();

type Status = "idle" | "submitting" | "submitted";

export function CountryGate() {
  const t = useTranslations("pages.country_gate");
  const [open, setOpen] = useState(false);
  const [detected, setDetected] = useState<string>("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    const value = getCookie(COUNTRY_COOKIE);
    if (!value) return;
    if (NEUTRAL_COOKIE_VALUES.has(value)) return;
    if (SUPPORTED_LOCALES.includes(value)) return;
    setDetected(value.toUpperCase());
    setOpen(true);
  }, []);

  function handleClose(reason: "submitted" | "explored" | "dismissed") {
    if (reason === "submitted" || reason === "explored") {
      setCookie(COUNTRY_COOKIE, "mx");
    } else {
      setCookie(COUNTRY_COOKIE, "dismissed");
    }
    setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = EmailSchema.safeParse(email);
    if (!parsed.success) {
      setEmailError(t("validation_invalid_email"));
      return;
    }
    setEmailError(null);
    setStatus("submitting");

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      toast.error(t("toast_error"));
      setStatus("idle");
      return;
    }

    try {
      await submitWaitlist({
        apiUrl,
        email: parsed.data,
        country: detected,
        source: "unsupported_modal",
        detectedCountry: detected,
      });
      toast.success(t("toast_success", { country: countryName(detected) }));
      setStatus("submitted");
      handleClose("submitted");
    } catch {
      toast.error(t("toast_error"));
      setStatus("idle");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose("dismissed");
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div aria-hidden className="text-2xl mb-2">
            {t("flag_emoji")}
          </div>
          <DialogTitle className="text-h3 text-navy">{t("title")}</DialogTitle>
          <DialogDescription className="text-body text-navy/70">
            {t("body", { country: countryName(detected) })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="sr-only">{t("email_label")}</span>
            <Input
              type="email"
              placeholder={t("email_placeholder")}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              required
              disabled={status === "submitting"}
              aria-invalid={emailError ? "true" : "false"}
            />
            {emailError ? (
              <span className="mt-1 block text-caption text-coral">
                {emailError}
              </span>
            ) : null}
          </label>
          <Button
            type="submit"
            className="w-full bg-coral hover:bg-coral-light text-white"
            disabled={status === "submitting"}
          >
            {status === "submitting" ? t("submitting") : t("submit")}
          </Button>
        </form>

        <div className="mt-2 text-center">
          <button
            type="button"
            className="text-body-sm font-medium text-navy underline-offset-4 hover:underline"
            onClick={() => handleClose("explored")}
          >
            {t("explore_anyway")}
          </button>
          <p className="mt-1 text-caption text-navy/55">
            {t("explore_caption")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
