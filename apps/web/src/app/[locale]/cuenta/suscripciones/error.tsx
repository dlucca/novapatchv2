"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("cuenta.errors");
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-destructive text-sm">{t("title")}</p>
      <p className="text-muted-foreground text-xs">{error.message}</p>
      <Button variant="outline" size="sm" onClick={() => reset()}>
        {t("retry")}
      </Button>
    </div>
  );
}
