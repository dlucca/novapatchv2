import type { ProductMeta } from "@/lib/products";
import type { ProductContent } from "@/lib/products-content";
import { RETAIL_PRICE } from "@/lib/products";

interface BuildArgs {
  product: ProductMeta;
  content: ProductContent;
  siteUrl: string;
  locale: string;
}

interface ProductJsonLd {
  "@context": "https://schema.org";
  "@type": "Product";
  name: string;
  description: string;
  image: string;
  brand: { "@type": "Brand"; name: "Novapatch" };
  offers: {
    "@type": "Offer";
    url: string;
    priceCurrency: "MXN";
    price: number;
    availability: "https://schema.org/InStock";
  };
}

export function buildPdpJsonLd(args: BuildArgs): ProductJsonLd {
  const { product, content, siteUrl, locale } = args;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `Novapatch ${product.name}`,
    description: content.hero.subhead,
    image: `${siteUrl}${product.image}`,
    brand: { "@type": "Brand", name: "Novapatch" },
    offers: {
      "@type": "Offer",
      url: `${siteUrl}/${locale}/productos/${product.slug}`,
      priceCurrency: "MXN",
      price: RETAIL_PRICE,
      availability: "https://schema.org/InStock",
    },
  };
}

interface PdpJsonLdProps {
  product: ProductMeta;
  content: ProductContent;
  siteUrl: string;
  locale: string;
}

export function PdpJsonLd(props: PdpJsonLdProps) {
  const data = buildPdpJsonLd(props);
  // Children-as-string for ld+json is the React-19-friendly safe pattern.
  // Next.js + React 19 emit the JSON verbatim.
  return (
    <script type="application/ld+json">{JSON.stringify(data)}</script>
  );
}
