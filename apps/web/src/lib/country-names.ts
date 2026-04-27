/**
 * Spanish country names for the country-gate modal copy. Keys are ISO
 * alpha-2 uppercase. Codes outside this list fall back to "tu país".
 */
export const COUNTRY_NAMES_ES: Record<string, string> = {
  AR: "Argentina",
  BR: "Brasil",
  CL: "Chile",
  CO: "Colombia",
  PE: "Perú",
  UY: "Uruguay",
  PY: "Paraguay",
  EC: "Ecuador",
  BO: "Bolivia",
  VE: "Venezuela",
  MX: "México",
  US: "Estados Unidos",
  CA: "Canadá",
  ES: "España",
};

export function countryName(code: string | null | undefined): string {
  if (!code) return "tu país";
  return COUNTRY_NAMES_ES[code.toUpperCase()] ?? "tu país";
}
