"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

type Variant = "default" | "secondary" | "outline" | "destructive";

const VARIANT_BY_STATUS: Record<string, Variant> = {
  active: "default",
  paused: "secondary",
  canceled: "outline",
  past_due: "destructive",
  delayed_oos: "secondary",
  paid: "default",
  failed: "destructive",
  refunded: "outline",
};

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("cuenta.status");
  const variant = VARIANT_BY_STATUS[status] ?? "secondary";
  let label = status;
  try {
    label = t(status);
  } catch {
    label = status;
  }
  return <Badge variant={variant}>{label}</Badge>;
}
