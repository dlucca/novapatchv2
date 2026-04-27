import { Hero } from "@/components/home/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { Absorption } from "@/components/home/absorption";
import { Comparison } from "@/components/home/comparison";
import { ProductGrid } from "@/components/home/product-grid";
import { SubscriptionTeaser } from "@/components/home/subscription-teaser";
import { FinalCTA } from "@/components/home/final-cta";

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  return (
    <>
      <Hero />
      <HowItWorks />
      <Absorption />
      {/* Server component — pass locale explicitly */}
      <Comparison locale={locale} />
      <ProductGrid />
      <SubscriptionTeaser locale={locale} />
      <FinalCTA />
    </>
  );
}
