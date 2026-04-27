import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { NOVA_PRODUCTS } from "@/lib/products";
import { getProductContent } from "@/lib/products-content";
import { getSiteUrl } from "@/lib/site";
import { PdpHero } from "@/components/pdp/pdp-hero";
import { PdpTarget } from "@/components/pdp/pdp-target";
import { PdpProblem } from "@/components/pdp/pdp-problem";
import { PdpMoments } from "@/components/pdp/pdp-moments";
import { PdpFormula } from "@/components/pdp/pdp-formula";
import { PdpScience } from "@/components/pdp/pdp-science";
import { PdpPromises } from "@/components/pdp/pdp-promises";
import { PdpClaims } from "@/components/pdp/pdp-claims";
import { PdpFaq } from "@/components/pdp/pdp-faq";
import { PdpStickyCta } from "@/components/pdp/pdp-sticky-cta";
import { PdpJsonLd } from "@/components/pdp/pdp-jsonld";

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return NOVA_PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = NOVA_PRODUCTS.find((p) => p.slug === slug);
  const content = getProductContent(slug);
  if (!product || !content) return { title: "Novapatch" };

  const siteUrl = getSiteUrl();
  const title = `Novapatch ${product.name} · ${content.hero.eyebrow}`;
  const description = content.hero.subhead;
  const image = `${siteUrl}${product.image}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: image, width: 1200, height: 1200, alt: product.name }],
      type: "website",
      url: `${siteUrl}/${locale}/productos/${slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { locale, slug } = await params;
  const product = NOVA_PRODUCTS.find((p) => p.slug === slug);
  const content = getProductContent(slug);
  if (!product || !content) notFound();

  const heroAnchorId = "pdp-hero-cta";
  const siteUrl = getSiteUrl();

  return (
    <>
      <PdpJsonLd
        product={product}
        content={content}
        siteUrl={siteUrl}
        locale={locale}
      />
      <div id={heroAnchorId}>
        <PdpHero product={product} content={content.hero} />
      </div>
      <PdpTarget locale={locale} content={content.target} />
      <PdpProblem content={content.problem} />
      <PdpMoments content={content.moments} />
      <PdpFormula locale={locale} content={content.formula} />
      <PdpScience content={content.science} />
      <PdpPromises content={content.promises} />
      <PdpClaims content={content.claims} />
      <PdpFaq faq={content.faq} />
      <PdpStickyCta product={product} observeTargetId={heroAnchorId} />
    </>
  );
}
