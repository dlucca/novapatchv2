import type { ProductMeta } from "@/lib/products";

type Slug = ProductMeta["slug"];

export type LucideIconName =
  | "Sun"
  | "Moon"
  | "Sparkles"
  | "Shield"
  | "Heart"
  | "Coffee"
  | "Sunrise"
  | "Wind"
  | "Leaf";

export type FaqItem = { q: string; a: string };

export type ProductContent = {
  slug: Slug;
  hero: { eyebrow: string; headline: string; subhead: string };
  problem: { eyebrow: string; title: string; lead: string; bullets: string[] };
  target: {
    primary_eyebrow: string;
    primary: string[];
    not_for_eyebrow: string;
    not_for: string[];
  };
  moments: {
    eyebrow: string;
    title: string;
    items: { icon: LucideIconName; title: string; desc: string }[];
  };
  formula: {
    eyebrow: string;
    title: string;
    lead: string;
    ingredients: { name: string; role: string }[];
  };
  science: { eyebrow: string; title: string; lead: string };
  promises: {
    promise_eyebrow: string;
    promise: string[];
    not_promise_eyebrow: string;
    not_promise: string[];
  };
  claims: { eyebrow: string; items: string[] };
  faq: FaqItem[];
  tagline: string;
};

// Content filled in Tasks 2 + 3 (curated from .docx marketing knowledge base)
export const PRODUCTS_CONTENT = {} as Record<Slug, ProductContent>;

export function getProductContent(slug: string): ProductContent | undefined {
  return (PRODUCTS_CONTENT as Record<string, ProductContent>)[slug];
}
