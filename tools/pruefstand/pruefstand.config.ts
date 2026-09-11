/**
 * Teil P — der Prüfstand. Adressen, Breiten, Schwellwerte.
 *
 * Dieser Ordner wird von der Anwendung nie importiert. Er misst und schreibt auf;
 * er bewertet nicht. Alle Schwellwerte stehen hier, damit im Messcode keine Zahl
 * vergraben ist, die niemand findet.
 */

export type ZielName = "preview" | "vorschau" | "live" | "lokal";

export interface Ziel {
  adresse: string;
  hinweis?: string;
}

export const ZIELE: Record<ZielName, Ziel> = {
  /** Die Editor-Vorschau von Lovable. Ohne angemeldete Sitzung antwortet sie mit
   *  302 auf lovable.dev/auth-bridge — der Prüfstand erkennt das und meldet es,
   *  statt eine Anmeldeseite zu vermessen. */
  preview: {
    adresse: "https://id-preview--81416573-4f0e-4ff7-a863-43988a85e8d2.lovable.app",
    hinweis: "Editor-Vorschau, nur mit angemeldeter Lovable-Sitzung erreichbar",
  },
  /** Die veröffentlichte Lovable-Vorschau. Öffentlich erreichbar, zeigt denselben
   *  Stand wie die Editor-Vorschau. */
  vorschau: {
    adresse: "https://pawn-archive-muse.lovable.app",
    hinweis: "veröffentlichte Vorschau, ohne Anmeldung erreichbar",
  },
  live: {
    adresse: "https://pawn.vision",
  },
  /** Der gebaute Stand aus diesem Arbeitsverzeichnis, lokal ausgeliefert:
   *    npm run build && npx vite preview --port 4173
   *  Misst denselben Code, der veröffentlicht würde — nützlich VOR dem Push, und
   *  der einzige Weg in Umgebungen, deren Browser keinen Ausgang ins Netz hat. */
  lokal: {
    adresse: "http://127.0.0.1:4173",
    hinweis: "gebauter Stand aus diesem Arbeitsverzeichnis (npx vite preview)",
  },
};

export const VORGABE_ZIEL: ZielName = "preview";

export interface Breite {
  /** Name für den Bericht. „844" allein sagt nicht, ob hoch oder quer. */
  name: string;
  breite: number;
  hoehe: number;
  /**
   * Finger oder Maus. Der Browser emuliert entsprechend (`hasTouch`, `isMobile`),
   * die Medienabfrage `pointer: coarse` trifft also bei „finger" zu und bei
   * „maus" nicht. Das ist die Bedingung, an der der Dreh-Hinweis hängt.
   */
  eingabe: "finger" | "maus";
  /**
   * Werden hier Trefferflächen (3.5) gemessen?
   *
   * Nicht überall sinnvoll. Am Schreibtisch bedient die Maus, dort gilt die
   * 44-px-Regel nicht. Gemessen wird deshalb dort, wo mit dem Finger wirklich
   * bedient wird: quer auf dem Telefon und auf dem Tablet.
   */
  trefferflaechen: boolean;
}

export const BREITEN: Breite[] = [
  // Die vier gewachsenen Größen. Sie bleiben unverändert an ihrem Platz, damit
  // die Reihe über alle Läufe hinweg vergleichbar bleibt.
  { name: "390 hoch", breite: 390, hoehe: 844, eingabe: "finger", trefferflaechen: false },
  { name: "768", breite: 768, hoehe: 1024, eingabe: "finger", trefferflaechen: true },
  { name: "1280", breite: 1280, hoehe: 900, eingabe: "maus", trefferflaechen: false },
  { name: "1920", breite: 1920, hoehe: 1080, eingabe: "maus", trefferflaechen: false },
  // Das Telefon nach dem Drehen. Eine echte Lage, die vor Teil P niemand
  // gemessen hat — sie bleibt in der Reihe, auch ohne das Magazin.
  { name: "844 quer", breite: 844, hoehe: 390, eingabe: "finger", trefferflaechen: true },
];

export interface SeitenZiel {
  name: string;
  pfad: string;
}

/** Die vier, an denen Geld und Vertrauen hängen. Slugs stehen hier, nicht im Code. */
export const PRODUKT_SLUG = "obara-rope-jacket";
export const HAUS_SLUG = "obara";

/** Die Halle — die Startseite. */
export const HALLE_PFAD = "/";

/** Die Suche — der Katalog des Hefts. */
export const BOUTIQUE_PFAD = "/suche";

export const SEITEN: SeitenZiel[] = [
  /*
   * Teil H — gemessen wird, was ausgeliefert wird. Seit dem Einzug des Hefts
   * sind das seine Adressen; `/shop`, `/product/:slug`, `/designer/:slug` und
   * `/ausgabe/001` antworten mit 301 bzw. 404. Sie zu messen hieße, einen Umzug
   * zu messen und Rot zu lehren, das niemand mehr liest.
   *
   * Sechs Seiten statt fünf: die Tasche kommt dazu, weil an ihr Geld hängt und
   * sie die einzige Fläche ist, die vom Heft direkt zu Stripe führt.
   */
  { name: "halle", pfad: HALLE_PFAD },
  { name: "suche", pfad: BOUTIQUE_PFAD },
  { name: "werk", pfad: `/werk/${PRODUKT_SLUG}` },
  { name: "haus", pfad: `/haus/${HAUS_SLUG}` },
  { name: "welt-mode", pfad: "/mode" },
  { name: "tasche", pfad: "/tasche" },
  /* Teil L5 — der Zugang ist seit dem Umzug ins Heft eine Doppelseite und keine
     eigene Seite mehr. Er wird gemessen, weil ohne ihn niemand ein Konto bekommt. */
  { name: "zugang", pfad: "/konto" },
];

/** Absichtlich ungültig — für 4.5. */
export const UNSINN_PFAD = "/diese-seite-gibt-es-nicht-4d9f21";

/**
 * Die Hosts, von denen die Seite ihre Inhalte holt.
 *
 * Schlägt dorthin eine Anfrage fehl, zeigt der Browser eine leere Hülle: keine
 * Werke, keine Bilder, ein Fuß, der in den ersten Bildschirm rutscht. Alles,
 * was man daran misst, ist wahr über die Hülle und falsch über die Seite.
 * Deshalb bekommen in dem Fall ALLE Befunde dieser Seite `nicht_pruefbar`
 * (s. `huelleMarkieren` in `lauf.ts`) — eine leere Hülle darf nie als Ergebnis
 * durchgehen, weder als bestanden noch als gefallen.
 */
export const DATEN_HOSTS = ["supabase.co"];

/**
 * Anfragen, die das Heft SELBST abbricht — sie sind kein Beweis, dass Daten fehlen.
 *
 * BELEGT am 2026-09-11, Lauf #150 auf Zweig claude/teil-m-kette: der Lauf meldete
 * „KEIN URTEIL — nur 1 von 1052 Gates messbar". Die EINE fehlgeschlagene Anfrage je
 * Seite war jedes Mal dieselbe:
 *
 *   https://<projekt>.supabase.co/auth/v1/health — net::ERR_ABORTED
 *
 * Das ist das Anklopfen aus src/heft03/notbetrieb.mjs (Teil L13). Es bricht nach
 * seiner Frist selbst ab — genau dafuer ist es gebaut. Der Huellen-Waechter sah
 * darin „Anfrage an den Datenhost fehlgeschlagen" und entwertete jede Seite.
 *
 * Damit war der Pruefstand ab L13 dauerhaft blind, und zwar durch eigenen Code,
 * nicht durch ein kaputtes Netz. Eine Messung, die sich selbst entwertet, ist so
 * wertlos wie eine, die gruen meldet, ohne gemessen zu haben.
 *
 * ENG geschrieben: nur dieser eine Pfad, nur ein Abbruch. Schlaegt das Anklopfen
 * mit einem ECHTEN Transportfehler fehl (DNS, Verbindung abgewiesen), zaehlt es
 * weiter als Huelle — dann ist die Datenbank wirklich nicht zu erreichen.
 */
export const EIGENE_ABBRUECHE = [
  { pfad: "/auth/v1/health", fehler: "net::ERR_ABORTED" },
];

export const SCHWELLEN = {
  /** 3.3 — WCAG. Klein: unter 24 px, bzw. unter 18,66 px wenn fett. */
  kontrast_klein: 4.5,
  kontrast_gross: 3.0,
  gross_ab_px: 24,
  gross_ab_px_fett: 18.66,
  fett_ab_gewicht: 700,
  /** Kürzere Texte als das werden nicht gemessen (Trennzeichen, Symbole). */
  kontrast_min_zeichen: 2,

  /** 3.5 — Trefferfläche in px, nur bei Eingabeart „finger". */
  trefferflaeche: 44,

  /** 3.8 — ab welchem Anteil der kleineren Fläche eine Überschneidung gemeldet wird. */
  ueberlappung_min_anteil: 0.25,
  /** Waagerechter Überlauf in px, ab dem gemeldet wird (1 px sind Rundungen). */
  ueberlauf_px: 1,

  /** 4.7 — Gewicht je Seite in Byte. */
  gewicht_seite: 3_000_000,

  /** Wie viele der kleinsten/größten Werte im Bericht landen. */
  liste_laenge: 10,
} as const;

/**
 * Wartezeit nach dem Laden, bevor gemessen wird (React braucht einen Moment).
 *
 * Sie muss über der längsten Eröffnung liegen, die eine Seite abspielt — sonst
 * misst man eine Fläche, die noch darüber liegt, und nennt das Ergebnis einen
 * Befund. Der Wert stammt aus der Magazin-Zeit (längste Eröffnung 3900 ms) und
 * bleibt bewusst stehen: zu lange warten macht die Messung langsam, zu kurz
 * warten macht sie falsch.
 */
export const RUHE_MS = 4300;

/** Chromium-Pfad, falls die Umgebung einen mitbringt (Container, CI). */
export const CHROMIUM_PFAD = process.env.PRUEFSTAND_CHROMIUM ?? undefined;
