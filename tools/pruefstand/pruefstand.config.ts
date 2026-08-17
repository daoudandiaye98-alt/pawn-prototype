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
   * 44-px-Regel nicht. Und im HOCHFORMAT auf dem Telefon zeigt das Heft keine
   * Bedienung mehr, sondern den Dreh-Hinweis — Flächen dort zu vergrößern
   * hieße, einen Bildschirm zu polieren, den niemand mehr sieht. Gemessen wird
   * deshalb dort, wo mit dem Finger wirklich bedient wird: quer auf dem Telefon
   * und auf dem Tablet.
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
  // Neu: das Telefon nach dem Drehen. Das ist die Lage, in der das Heft
  // gelesen und bedient wird — vorher hat sie niemand gemessen.
  { name: "844 quer", breite: 844, hoehe: 390, eingabe: "finger", trefferflaechen: true },
];

export interface SeitenZiel {
  name: string;
  pfad: string;
}

/** Die vier, an denen Geld und Vertrauen hängen. Slugs stehen hier, nicht im Code. */
export const PRODUKT_SLUG = "obara-rope-jacket";
export const HAUS_SLUG = "obara";

/** Der Umschlag — die erste Doppelseite der Hülle (X5, Sektion „umschlag"). */
export const HEFT_PFAD = "/heft/umschlag";

/** Das erste Blatt des Katalogs (X6). */
export const VERZEICHNIS_PFAD = "/verzeichnis/1";

export const SEITEN: SeitenZiel[] = [
  { name: "halle", pfad: "/" },
  // Teil M — das Ausgabe-Heft. Gehört zum öffentlichen Frontend, also in die Messung.
  { name: "ausgabe", pfad: "/ausgabe/001" },
  { name: "boutique", pfad: "/shop" },
  { name: "werk", pfad: `/product/${PRODUKT_SLUG}` },
  { name: "haus", pfad: `/designer/${HAUS_SLUG}` },
  /*
   * Teil X — die Hülle. Sie war bisher NICHT in dieser Liste, und deshalb hat
   * kein Lauf je etwas über sie gesagt: weder über die Doppelseiten noch über
   * den Dreh-Hinweis, der nur hier lebt. Das war die eigentliche Lücke.
   */
  { name: "huelle", pfad: HEFT_PFAD },
  /*
   * Teil X6 — das Verzeichnis. Eigene Zeile und nicht mit der Hülle erledigt:
   * es ist die einzige Heftseite, die aus Daten entsteht, die einzige mit einem
   * Raster aus zwölf Einträgen und die einzige, an deren Blattrand Schalter
   * hängen (die Filterreiter). Genau daran fällt eine Messung, wenn sie fällt.
   */
  { name: "verzeichnis", pfad: VERZEICHNIS_PFAD },
  /*
   * Teil X7 — das Werk als Doppelseite. Dieselbe Ware wie die alte Werkseite
   * darüber, damit beide Fassungen an denselben Zahlen gemessen werden.
   *
   * Sie ist zugleich die einzige Heftadresse, die den Dreh-Hinweis NIE zeigen
   * darf (`NIE_SPERREN`): ein Kaufweg, der im Hochformat am Bildschirmrand
   * endet, ist kein Kaufweg. Ohne diese Zeile stünde diese Regel im Code, ohne
   * dass je jemand nachgesehen hätte.
   *
   * Gegen eine lokale Vorschau ist sie `nicht_pruefbar`: das Heft erreicht dort
   * seine Datenschicht nicht, also gibt es die Doppelseite nicht. Genau dafür
   * ist die Hüllen-Regel da.
   */
  { name: "werk-heft", pfad: `/werk/${PRODUKT_SLUG}` },
];

/**
 * Adressen, auf denen der Dreh-Hinweis im Hochformat erwartet wird.
 *
 * Jede Heftadresse bittet ums Drehen — das Verzeichnis also auch. Zwei Adressen
 * sind ausdrücklich ausgenommen und dürfen ihn NIE zeigen (X9 die Kasse, X7 die
 * Werkseite); die stehen in `NIE_SPERREN` in `src/heft/drehhinweis.tsx`.
 */
export const DREH_ERWARTET = [HEFT_PFAD, VERZEICHNIS_PFAD];

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
 * Befund. Längster Fall heute: die Eröffnung des Hefts mit 3900 ms
 * (`src/features/heft/Eroeffnung.tsx`, ENDE_MS).
 */
export const RUHE_MS = 4300;

/** Chromium-Pfad, falls die Umgebung einen mitbringt (Container, CI). */
export const CHROMIUM_PFAD = process.env.PRUEFSTAND_CHROMIUM ?? undefined;
