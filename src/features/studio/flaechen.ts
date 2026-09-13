/**
 * Die Tab-Leisten der gefalteten Flaechen — an EINER Stelle.
 *
 * Der Fehler, den das behebt: „Werke", „Bilder" und „Rochade" sind dieselbe Flaeche,
 * hatten aber drei verschiedene Leisten. StudioProducts zeigte alle drei Tabs,
 * StudioMediathek nur zwei (kein Weg zur Rochade), und StudioRochade gar keine — von
 * dort kam man nicht zurueck. Drei Seiten, drei Wahrheiten.
 *
 * Dazu stand „Rochade" HARTKODIERT DEUTSCH im Code, ohne Sprachschluessel. Das ist
 * schlimmer als ein fehlender Schluessel: es faellt nie auf, weil die deutsche Seite
 * richtig aussieht — nur die englische zeigt dann mitten im Satz ein deutsches Wort.
 *
 * Die Leisten stehen als Schluessel da, nicht als Text: jede Seite ruft `t()` selbst.
 * So braucht dieses Modul den i18n-Haken nicht und bleibt ohne React pruefbar.
 */
export type FlaechenTab = { labelKey: string; to: string; end?: boolean };

/** Die Flaeche „Wand" — alles, was ein Haus an Werken und Bildern hat. */
export const WERKE_TABS: FlaechenTab[] = [
  { labelKey: "studio.tabs.werke", to: "/studio/werke" },
  { labelKey: "studio.tabs.bilder", to: "/studio/werke/bilder" },
  { labelKey: "studio.tabs.rochade", to: "/studio/werke/rochade" },
];

/** Die Flaeche „Auftritt" — die Doppelseite und ihr Stil. */
export const AUFTRITT_TABS: FlaechenTab[] = [
  { labelKey: "studio.tabs.seite", to: "/studio/doppelseite" },
  { labelKey: "studio.tabs.stil", to: "/studio/doppelseite/stil" },
];

/** Die Flaeche „Clips" — was entsteht und was fertig ist. */
export const CLIPS_TABS: FlaechenTab[] = [
  { labelKey: "studio.tabs.neu", to: "/studio/clips" },
  { labelKey: "studio.tabs.fertig", to: "/studio/clips/fertig" },
];
