"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { Subscription } from "@/lib/api";
import { ApiError } from "@/lib/api";
import {
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  changeFrequency,
} from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import { formatDate, addDaysUtc } from "@/lib/dates";
import { toBcp47 } from "@/lib/i18n";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "./status-badge";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface Props {
  sub: Subscription;
  locale: string;
  apiUrl: string;
}

export function SubscriptionCard({ sub, locale, apiUrl }: Props) {
  const t = useTranslations("cuenta.subscriptions");
  const bcp = toBcp47(locale);
  const router = useRouter();
  const { getToken } = useAuth();

  const [inFlight, setInFlight] = useState(false);
  const [pendingInterval, setPendingInterval] = useState<30 | 60 | 90 | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  async function withToken(fn: (token: string) => Promise<unknown>, toastMessage: string) {
    const token = await getToken();
    if (!token) {
      toast.error(t("toasts.session_expired"));
      return;
    }
    setInFlight(true);
    try {
      await fn(token);
      toast.success(toastMessage);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) toast.error(t("toasts.session_expired"));
        else toast.error(t("toasts.generic_error", { code: err.code }));
      } else {
        toast.error(t("toasts.generic_error", { code: "unknown" }));
      }
    } finally {
      setInFlight(false);
    }
  }

  async function onPause() {
    await withToken(
      (token) => pauseSubscription({ token, apiUrl, id: sub.id }),
      t("toasts.paused"),
    );
  }

  async function onResume() {
    const nextDate = addDaysUtc(new Date(), sub.intervalDays);
    await withToken(
      (token) => resumeSubscription({ token, apiUrl, id: sub.id }),
      t("toasts.resumed", { date: formatDate(nextDate, bcp) }),
    );
  }

  async function onConfirmFrequency() {
    if (pendingInterval === null) return;
    const chosen = pendingInterval;
    const nextDate = addDaysUtc(new Date(), chosen);
    await withToken(
      (token) => changeFrequency({ token, apiUrl, id: sub.id, intervalDays: chosen }),
      t("toasts.frequency_changed", { date: formatDate(nextDate, bcp) }),
    );
    setPendingInterval(null);
  }

  async function onConfirmCancel() {
    await withToken(
      (token) => cancelSubscription({ token, apiUrl, id: sub.id }),
      t("toasts.canceled"),
    );
    setCancelOpen(false);
  }

  const isTerminal = sub.status === "canceled";
  const isBillingIssue = sub.status === "past_due" || sub.status === "delayed_oos";
  const canPause = sub.status === "active";
  const canResume = sub.status === "paused";
  const canChangeFrequency = sub.status === "active" || sub.status === "paused";
  const canCancel = !isTerminal;

  const intervalOptions: Array<{ value: 30 | 60 | 90; labelKey: string }> = [
    { value: 30, labelKey: "every_30" },
    { value: 60, labelKey: "every_60" },
    { value: 90, labelKey: "every_90" },
  ];

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">{capitalize(sub.productSlug)}</CardTitle>
            <CardDescription>
              {t("every_days", { days: sub.intervalDays })} ·{" "}
              {formatMoney(sub.unitPrice, sub.currency, bcp)}
            </CardDescription>
          </div>
          <StatusBadge status={sub.status} />
        </CardHeader>
        <CardContent className="text-sm">
          {!isTerminal && (
            <p className="text-muted-foreground">
              {t("next_billing")}: {formatDate(sub.nextBillingDate, bcp)}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          {canPause && (
            <Button size="sm" variant="outline" onClick={onPause} disabled={inFlight}>
              {t("actions.pause")}
            </Button>
          )}
          {canResume && (
            <Button size="sm" onClick={onResume} disabled={inFlight}>
              {t("actions.resume")}
            </Button>
          )}
          {canChangeFrequency && (
            <Select
              disabled={inFlight}
              value={String(sub.intervalDays)}
              onValueChange={(v) => {
                const n = Number(v) as 30 | 60 | 90;
                if (n !== sub.intervalDays) setPendingInterval(n);
              }}
            >
              <SelectTrigger className="h-9 w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {intervalOptions.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {t(`frequency_options.${opt.labelKey}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {canCancel && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setCancelOpen(true)}
              disabled={inFlight}
            >
              {t("actions.cancel")}
            </Button>
          )}
          {isBillingIssue && (
            <span className="text-muted-foreground text-xs">
              {/* Only cancel is shown for billing-issue statuses; no extra copy needed */}
            </span>
          )}
        </CardFooter>
      </Card>

      {/* Frequency confirm dialog */}
      <Dialog
        open={pendingInterval !== null}
        onOpenChange={(open) => {
          if (!open) setPendingInterval(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("frequency_dialog.title")}</DialogTitle>
            <DialogDescription>
              {pendingInterval !== null
                ? t("frequency_dialog.body", {
                    date: formatDate(addDaysUtc(new Date(), pendingInterval), bcp),
                  })
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingInterval(null)}
              disabled={inFlight}
            >
              {t("actions.back")}
            </Button>
            <Button onClick={onConfirmFrequency} disabled={inFlight}>
              {t("actions.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirm alert dialog */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cancel_dialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("cancel_dialog.body")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={inFlight}>
              {t("cancel_dialog.back")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmCancel}
              disabled={inFlight}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("cancel_dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
