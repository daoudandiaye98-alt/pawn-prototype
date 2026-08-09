import { useI18n } from "@/lib/i18n";

/**
 * Teil 39 AP7 — Rechtstexte (Impressum/AGB/Datenschutz/Widerruf) waren bislang hardcodiertes
 * Deutsch, obwohl LegalTranslationNote schon eine "maschinenunterstützte Übersetzung" ankündigte
 * — ein Widerspruch für englischsprachige Besucher:innen. Dieser Hook liefert echten, kuratierten
 * englischen Text neben dem deutschen; die deutsche Fassung bleibt in jedem Fall verbindlich.
 */
export function useLegalText() {
  const { locale } = useI18n();
  return (de: string, en: string): string => (locale === "en" ? en : de);
}
