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
