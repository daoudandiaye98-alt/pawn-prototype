import { useI18n } from "@/lib/i18n";

/**
 * Rechtstexte sind auf Englisch nur eine Lesehilfe — verbindlich bleibt die deutsche Fassung.
 * Erscheint ausschließlich, wenn die Oberfläche auf Englisch steht.
 */
export function LegalTranslationNote() {
  const { locale } = useI18n();
  if (locale !== "en") return null;
  return (
    <p
      data-no-translate
      className="mt-6 border border-[rgba(0,0,0,.18)] px-4 py-3 text-[0.8rem] uppercase tracking-[0.14em] text-[#000000]/70"
    >
      Machine-assisted translation for convenience. Only the German version is legally binding.
    </p>
  );
}
