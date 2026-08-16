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
  breite: number;
  hoehe: number;
  /** Finger oder Maus — entscheidet über Trefferflächen-Schwelle und Fokus-Prüfung. */
  eingabe: "finger" | "maus";
}

export const BREITEN: Breite[] = [
  { breite: 390, hoehe: 844, eingabe: "finger" },
  { breite: 768, hoehe: 1024, eingabe: "finger" },
  { breite: 1280, hoehe: 900, eingabe: "maus" },
  { breite: 1920, hoehe: 1080, eingabe: "maus" },
];

export interface SeitenZiel {
  name: string;
  pfad: string;
}

/** Die vier, an denen Geld und Vertrauen hängen. Slugs stehen hier, nicht im Code. */
export const PRODUKT_SLUG = "obara-rope-jacket";
export const HAUS_SLUG = "obara";

export const SEITEN: SeitenZiel[] = [
  { name: "halle", pfad: "/" },
  // Teil M — das Heft. Gehört ab jetzt zum öffentlichen Frontend, also in die Messung.
  { name: "heft", pfad: "/ausgabe/001" },
  { name: "boutique", pfad: "/shop" },
  { name: "werk", pfad: `/product/${PRODUKT_SLUG}` },
  { name: "haus", pfad: `/designer/${HAUS_SLUG}` },
];

/** Absichtlich ungültig — für 4.5. */
export const UNSINN_PFAD = "/diese-seite-gibt-es-nicht-4d9f21";

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

/** Wartezeit nach dem Laden, bevor gemessen wird (React braucht einen Moment). */
export const RUHE_MS = 2500;

/** Chromium-Pfad, falls die Umgebung einen mitbringt (Container, CI). */
export const CHROMIUM_PFAD = process.env.PRUEFSTAND_CHROMIUM ?? undefined;
