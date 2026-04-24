/**
 * Maps our route locale segments (market ids) to BCP 47 language tags
 * suitable for `Intl.*` APIs. Without this, `new Date().toLocaleDateString("mx")`
 * throws `RangeError: Incorrect locale information provided` because `"mx"`
 * is not a valid language tag.
 */
const BCP47_BY_LOCALE: Record<string, string> = {
  mx: "es-MX",
  br: "pt-BR",
  ar: "es-AR",
  cl: "es-CL",
  co: "es-CO",
};

export function toBcp47(locale: string): string {
  return BCP47_BY_LOCALE[locale] ?? "es-MX";
}
