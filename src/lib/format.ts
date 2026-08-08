import type { Locale } from "@/lib/i18n";

const INTL_LOCALE: Record<Locale, string> = { de: "de-DE", en: "en-US" };

/** €-Betrag, nach aktiver Sprache formatiert (Tausender-/Dezimaltrennzeichen). */
export function formatPrice(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { style: "currency", currency: "EUR" }).format(amount);
}

/** Ganzzahl, nach aktiver Sprache formatiert. */
export function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(n);
}

/** Datum, nach aktiver Sprache formatiert. */
export function formatDate(d: string | number | Date, locale: Locale, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], opts).format(new Date(d));
}

/** Credit-Zeile „№ 003 · Haus · Stadt/Material" — eine Schreibweise für Landing und Produktseite. */
export function formatCreditLine(opts: { houseNumber?: number | null; brandName: string; third?: string | null }): string {
  const parts: string[] = [];
  if (opts.houseNumber != null) parts.push(`№ ${String(opts.houseNumber).padStart(3, "0")}`);
  parts.push(opts.brandName);
  if (opts.third) parts.push(opts.third);
  return parts.join(" · ");
}
