import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/nextjs";
import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
import { routing } from "@/i18n/routing";
import "../globals.css";

export const metadata: Metadata = {
  title: "Novapatch",
  description: "Parches vitamínicos por suscripción.",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const t = await getTranslations({ locale, namespace: "nav" });

  return (
    <ClerkProvider>
      <html lang={locale}>
        <body>
          <NextIntlClientProvider>
            <header className="flex items-center justify-between border-b border-gray-200 p-4">
              <Link href={`/${locale}`} className="text-lg font-semibold">
                Novapatch
              </Link>
              <div className="flex items-center gap-4">
                <SignedIn>
                  <Link
                    href={`/${locale}/cuenta`}
                    className="text-sm text-gray-700 hover:underline"
                  >
                    {t("mi_cuenta")}
                  </Link>
                  <UserButton />
                </SignedIn>
                <SignedOut>
                  <SignInButton mode="modal">
                    <button className="rounded bg-black px-3 py-1.5 text-sm font-medium text-white">
                      {t("iniciar_sesion")}
                    </button>
                  </SignInButton>
                </SignedOut>
              </div>
            </header>
            {children}
            <Toaster position="bottom-right" richColors />
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
