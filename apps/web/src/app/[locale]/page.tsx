import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return (
    <main className="min-h-screen p-12">
      <h1 className="text-4xl font-bold">{t("title")}</h1>
      <p className="mt-4 text-gray-600">{t("subtitle")}</p>
      <Link
        href={`/${locale}/cuenta`}
        className="mt-8 inline-block rounded bg-black px-4 py-2 text-sm font-medium text-white"
      >
        {t("cta_cuenta")}
      </Link>
    </main>
  );
}
