import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return (
    <main className="min-h-screen p-12">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{t("subtitle")}</p>
          <Link
            href={`/${locale}/cuenta`}
            className="mt-6 inline-block rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {t("cta_cuenta")}
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
