import { getTranslations } from "next-intl/server";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { CuentaNav } from "@/components/cuenta/cuenta-nav";

export default async function CuentaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cuenta" });

  return (
    <main className="min-h-screen p-6 md:p-12">
      <Card className="mx-auto max-w-3xl">
        <CardHeader className="flex flex-col gap-4">
          <CardTitle>{t("title")}</CardTitle>
          <CuentaNav locale={locale} />
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </main>
  );
}
