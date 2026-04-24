/**
 * Formats integer cents as a localized currency string.
 *
 * Example:
 *   formatMoney(45000, "MXN", "es-MX") → "$450.00"
 */
export function formatMoney(
  cents: number,
  currency: string,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}
