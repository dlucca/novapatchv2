import type { Metadata } from "next";
import { TiendaHero } from "@/components/shop/tienda-hero";
import { ProductGridShop } from "@/components/shop/product-grid-shop";
import { getSiteUrl } from "@/lib/site";

interface TiendaPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: TiendaPageProps): Promise<Metadata> {
  const { locale } = await params;
  const siteUrl = getSiteUrl();
  return {
    title: "La tienda · Novapatch",
    description: "Seis parches, un bienestar para cada día.",
    openGraph: {
      title: "La tienda · Novapatch",
      description: "Seis parches, un bienestar para cada día.",
      url: `${siteUrl}/${locale}/tienda`,
      type: "website",
    },
  };
}

export default async function TiendaPage({ params }: TiendaPageProps) {
  const { locale } = await params;
  return (
    <>
      <TiendaHero locale={locale} />
      <ProductGridShop locale={locale} />
    </>
  );
}
