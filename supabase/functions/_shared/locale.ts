// Teil 25: Studio-seitige KI-Antworten in der Sprache des Nutzers — das Haus-Stilgesetz und
// das Sprachgesetz (voice_law) gelten in beiden Sprachen gleichermaßen, nur die Sprache wechselt.
export type UiLocale = "de" | "en";

export function normalizeLocale(raw: unknown): UiLocale {
  return raw === "en" ? "en" : "de";
}

export function localeInstruction(locale: UiLocale): string {
  return locale === "en"
    ? "Antworte ausschließlich auf Englisch. Ton, Regeln und Haltung bleiben exakt dieselben wie oben beschrieben — nur die Sprache wechselt."
    : "Antworte auf Deutsch.";
}

/** Systemmeldungen an ein Haus folgen dessen gespeicherter Sprache, nie der Browsersprache
 * dessen, der die Aktion gerade auslöst (Kunde bestellt, Cron läuft, Admin greift ein). */
export function pickByLang<T>(preferredLanguage: string | null | undefined, de: T, en: T): T {
  return preferredLanguage === "en" ? en : de;
}
