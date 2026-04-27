import type { MetadataRoute } from "next";
import { NOVA_PRODUCTS } from "@/lib/products";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const now = new Date();
  const out: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    out.push({
      url: `${base}/${locale}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    });
    out.push({
      url: `${base}/${locale}/tienda`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    });
    out.push({
      url: `${base}/${locale}/suscripciones`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    });
    for (const p of NOVA_PRODUCTS) {
      out.push({
        url: `${base}/${locale}/productos/${p.slug}`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  }

  return out;
}
