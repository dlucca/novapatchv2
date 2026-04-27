import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

/**
 * Resolves the user's country from the request.
 *
 * In production on Vercel, reads request.geo.country (ISO alpha-2 uppercase).
 * In development, defaults to "MX" so local work always behaves like a
 * supported visitor.
 *
 * Returns null when geo is unavailable in non-Vercel production (e.g. host
 * without geo enrichment) — the consumer treats null as "unknown" and
 * does NOT show the modal.
 */
export function getCountryFromRequest(req: NextRequest): string | null {
  const geo = (req as unknown as { geo?: { country?: string } }).geo;
  if (geo?.country) return geo.country.toUpperCase();
  if (process.env.NODE_ENV === "development") return "MX";
  return null;
}

/**
 * True if the country (alpha-2, any case) is in routing.locales.
 * Today only "mx" matches; AR fast-follow expands automatically when
 * the locales list is updated.
 */
export function isSupportedCountry(country: string | null): boolean {
  if (!country) return false;
  const lower = country.toLowerCase();
  return (routing.locales as readonly string[]).includes(lower);
}
