/**
 * Die drei Welten von PAWN: Mode, Interior, Kunst.
 * Eine Bewerbung, drei Handschriften — dieselbe Strecke, andere Sprache.
 */

export type DisciplineId = "mode" | "interior" | "kunst";

export interface DisciplineField {
  /** technischer Schlüssel, landet als Tag/Angabe in der Bewerbung */
  key: string;
  label: string;
  placeholder: string;
  /** Erklärzeile in einfacher Sprache */
  hint: string;
}

export interface Discipline {
  id: DisciplineId;
  label: string;
  /** Wie das Haus in der Ansprache genannt wird */
  maker: string;
  /** Wie die Arbeit genannt wird (Plural) */
  works: string;
  tagline: string;
  /** Beispielsätze für die fünf Akte der Bewerbungsseite */
  acts: {
    hausseite: string;
    publikum: string;
    studio: string;
    auszahlung: string;
    einblicke: string;
  };
  /** Was wir sehen wollen — Portfolio-Hinweis */
  portfolioHint: string;
  /** Disziplin-spezifische Fragen im Schritt „Deine Arbeit" */
  fields: DisciplineField[];
  /** Stil-Beispiele für das Tag-Feld */
  tagExample: string;
}

export const DISCIPLINES: Record<DisciplineId, Discipline> = {
  mode: {
    id: "mode",
    label: "Mode",
    maker: "Modehaus",
    works: "Stücke",
    tagline: "Kleidung, die eine Handschrift trägt.",
    acts: {
      hausseite:
        "Deine Kollektion als Lookbook statt als Katalogseite — Bilder groß, Text ruhig, jedes Stück mit seiner Geschichte.",
      publikum:
        "Wir zeigen dich Menschen, die Schnitt und Material lesen können — nicht denen, die nach dem billigsten Treffer suchen.",
      studio:
        "Aus deinen Fotos entsteht ein Lookbook-Clip: Bewegung, Stoff, Detail. Du gibst jede Veröffentlichung frei.",
      auszahlung:
        "Verkaufst du ein Stück, geht das Geld direkt auf dein Konto. Kein Umweg über uns.",
      einblicke:
        "Welche Silhouette bleibt hängen, welche Größe wird am häufigsten gesucht — bevor du die nächste Kollektion schneidest.",
    },
    portfolioHint:
      "3–8 Bilder: am liebsten getragene Stücke, ein Detail von Naht oder Stoff, und wenn möglich ein Blick in deine Werkstatt.",
    fields: [
      {
        key: "fertigung",
        label: "Wie fertigst du?",
        placeholder: "Eigene Werkstatt · kleine Manufaktur · auf Bestellung",
        hint: "Damit wir wissen, wie schnell ein Stück beim Kunden ist.",
      },
      {
        key: "groessen",
        label: "Welche Größen bietest du an?",
        placeholder: "XS–XL · Maßanfertigung · Einheitsgröße",
        hint: "PAWN hat einen Passform-Assistenten — deine Angabe macht ihn genau.",
      },
      {
        key: "materialien",
        label: "Womit arbeitest du am liebsten?",
        placeholder: "Wolle, recyceltes Leder, Deadstock-Seide",
        hint: "Material erzählt oft mehr über ein Haus als jeder Stilbegriff.",
      },
    ],
    tagExample: "avantgardistisch, tailoring, deadstock",
  },
  interior: {
    id: "interior",
    label: "Interior",
    maker: "Interior-Haus",
    works: "Objekte",
    tagline: "Objekte, die einen Raum verändern.",
    acts: {
      hausseite:
        "Deine Objekte im Raum statt freigestellt auf Weiß — Maßstab, Licht, Umgebung. Eine Seite, die sich wie ein Magazin liest.",
      publikum:
        "Wir zeigen dich Menschen, die für ein Stück auf Lieferung warten — nicht denen, die morgen ein Regal brauchen.",
      studio:
        "Aus deinen Fotos entsteht eine Raum-Szene: langsame Kamera, Materialnähe, Licht über die Oberfläche.",
      auszahlung:
        "Verkaufst du ein Objekt, geht das Geld direkt auf dein Konto. Kein Umweg über uns.",
      einblicke:
        "Welche Formen und Materialien Menschen anziehen — bevor du die nächste Serie in Produktion gibst.",
    },
    portfolioHint:
      "3–8 Bilder: das Objekt im echten Raum, ein Detail der Oberfläche, gern eine Skizze oder ein Blick in die Werkstatt.",
    fields: [
      {
        key: "material",
        label: "Aus welchem Material entstehen deine Objekte?",
        placeholder: "Massive Eiche, gegossener Beton, mundgeblasenes Glas",
        hint: "Material und Verarbeitung sind bei Interior das erste Verkaufsargument.",
      },
      {
        key: "fertigung",
        label: "Serie oder Einzelstück?",
        placeholder: "Kleinserie · Einzelanfertigung · auf Maß",
        hint: "Kunden wollen wissen, ob sie warten müssen — und wie lange.",
      },
      {
        key: "lieferung",
        label: "Wie kommen deine Objekte zum Kunden?",
        placeholder: "Spedition, Selbstabholung, Versand bis 30 kg",
        hint: "Große Objekte brauchen einen klaren Versandweg — das klären wir lieber vorher.",
      },
    ],
    tagExample: "brutalistisch, Massivholz, Kleinserie",
  },
  kunst: {
    id: "kunst",
    label: "Kunst",
    maker: "Atelier",
    works: "Werke",
    tagline: "Werke, die ihren eigenen Rahmen setzen.",
    acts: {
      hausseite:
        "Deine Werke mit Raum drumherum — Format, Technik, Entstehungsjahr. Kein Marktplatz-Raster, sondern eine Ausstellungsseite.",
      publikum:
        "Wir zeigen dich Menschen, die sammeln, nicht dekorieren — und die den Namen hinter dem Werk wissen wollen.",
      studio:
        "Aus deinen Aufnahmen entsteht eine Werkbetrachtung: langsamer Zoom, Oberfläche, Pinselzug, Stille.",
      auszahlung:
        "Verkaufst du ein Werk, geht das Geld direkt auf dein Konto. Kein Umweg über uns.",
      einblicke:
        "Welche Arbeiten Menschen lange betrachten und welche sie speichern — ein ehrliches Echo auf deine Serie.",
    },
    portfolioHint:
      "3–8 Bilder: Werke frontal und in gutem Licht, ein Detail der Oberfläche, gern eine Aufnahme aus dem Atelier.",
    fields: [
      {
        key: "technik",
        label: "In welcher Technik arbeitest du?",
        placeholder: "Öl auf Leinwand, Siebdruck, Bronzeguss, Fotografie",
        hint: "Die Technik gehört bei jedem Werk auf die Seite — wir übernehmen sie direkt.",
      },
      {
        key: "auflage",
        label: "Unikat oder Edition?",
        placeholder: "Unikate · Edition von 25 · beides",
        hint: "Sammler fragen als Erstes nach der Auflage.",
      },
      {
        key: "format",
        label: "In welchen Formaten arbeitest du?",
        placeholder: "40 × 60 cm bis 200 × 150 cm",
        hint: "Format bestimmt Preis, Versand und Rahmen — je genauer, desto besser.",
      },
    ],
    tagExample: "abstrakt, Siebdruck, Unikat",
  },
};

export const DISCIPLINE_LIST: Discipline[] = [
  DISCIPLINES.mode,
  DISCIPLINES.interior,
  DISCIPLINES.kunst,
];

/** Neutrale Fassung, wenn noch keine Welt gewählt wurde. */
export const NEUTRAL_ACTS: Discipline["acts"] = {
  hausseite:
    "Deine eigene Seite auf PAWN: deine Bilder, deine Reihenfolge, deine Worte. Editorial statt Katalog.",
  publikum:
    "Wir empfehlen dich nach Geschmack, nicht nach Ranking — in Cover Storys, Bannern und kuratierten Reihen.",
  studio:
    "Aus deinen Fotos entstehen Videos, Produktbilder und Texte. Du gibst jede Veröffentlichung frei. Nichts geht ohne dich raus.",
  auszahlung:
    "Bei jedem Verkauf gehen 93 % direkt auf dein Konto, 7 % bleiben bei PAWN. Keine Aufnahmegebühr, keine Sichtbarkeitspakete.",
  einblicke:
    "Du siehst, was Menschen ansehen, speichern und kaufen — als Entscheidungshilfe, nicht als Zahlenfriedhof.",
};

export function parseDiscipline(value: string | null | undefined): DisciplineId | null {
  if (!value) return null;
  const v = value.toLowerCase();
  return v === "mode" || v === "interior" || v === "kunst" ? v : null;
}
