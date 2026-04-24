/**
 * Formats a `YYYY-MM-DD` string or ISO timestamp as a localized date.
 */
export function formatDate(value: string, locale: string): string {
  const iso = value.length === 10 ? `${value}T00:00:00Z` : value;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}

/**
 * Mirrors the backend's `today + days` UTC arithmetic. Used by the frequency
 * dialog to show the customer what the new nextBillingDate will be before
 * they confirm the change.
 *
 * Returns a "YYYY-MM-DD" string.
 */
export function addDaysUtc(base: Date, days: number): string {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}
