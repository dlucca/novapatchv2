import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ClerkProvider } from "@clerk/nextjs";
import { routing } from "@/i18n/routing";
import { outfit, newsreader } from "@/lib/fonts";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { Toaster } from "@/components/ui/sonner";
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

  return (
    <ClerkProvider>
      <html lang={locale} className={`${outfit.variable} ${newsreader.variable}`}>
        <body>
          <NextIntlClientProvider>
            <Navbar locale={locale} />
            {children}
            <Footer locale={locale} />
            <Toaster position="bottom-right" richColors />
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
