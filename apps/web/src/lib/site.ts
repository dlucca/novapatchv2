const FALLBACK_SITE_URL = "https://novapatch.com";

export function getSiteUrl(): string {
  const env = process.env["NEXT_PUBLIC_SITE_URL"];
  return env && env.length > 0 ? env.replace(/\/$/, "") : FALLBACK_SITE_URL;
}
