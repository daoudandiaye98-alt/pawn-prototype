/**
 * Gemeinsame Typen und Rechenregeln für die erweiterten Stück-Angaben:
 * Größen mit eigenem Bestand, Maßtabelle, Materialzusammensetzung, Pflege und Mehrwertsteuer.
 * Bewusst frei von React — wird von Studio-Formular und öffentlicher Produktseite genutzt.
 */

export interface SizeVariant {
  /** Bezeichnung der Größe, z. B. "M" oder "38". */
  size: string;
  /** Bestand dieser Größe. Bei Anfertigung ohne Bedeutung. */
  stock: number;
  /** Aufpreis in Euro gegenüber dem Grundpreis. */
  surcharge: number;
  /** Eigene Artikelnummer, optional. */
  sku: string | null;
}

export interface MaterialPart {
  /** Material, z. B. "Wolle". */
  material: string;
  /** Anteil in Prozent. */
  percent: number;
}

/** Maßtabelle: Zeile (z. B. "Brustumfang") → Größe → Wert in cm. */
export interface Measurements {
  rows: string[];
  /** values[zeile][größe] = cm als Text (leer erlaubt). */
  values: Record<string, Record<string, string>>;
}

export const emptyMeasurements = (): Measurements => ({ rows: [], values: {} });

export const MEASUREMENT_PRESETS: Record<string, string[]> = {
  Mode: ["Schulterbreite", "Brustumfang", "Taillenumfang", "Hüftumfang", "Ärmellänge", "Gesamtlänge"],
  Interior: ["Breite", "Tiefe", "Höhe", "Sitzhöhe", "Tischhöhe", "Durchmesser"],
  Kunst: ["Breite", "Höhe", "Tiefe", "Bildmaß", "Rahmenmaß", "Blattmaß"],
};

/** Pflege/Handhabung — je Welt eine eigene Palette. */
export const CARE_SYMBOLS_BY_WORLD: Record<string, { key: string; label: string }[]> = {
  Mode: [
    { key: "handwaesche", label: "Handwäsche" },
    { key: "maschine_30", label: "Maschinenwäsche 30°" },
    { key: "nicht_bleichen", label: "Nicht bleichen" },
    { key: "nicht_trockner", label: "Nicht in den Trockner" },
    { key: "buegeln_niedrig", label: "Bügeln niedrig" },
    { key: "nicht_buegeln", label: "Nicht bügeln" },
    { key: "chemische_reinigung", label: "Chemische Reinigung" },
    { key: "liegend_trocknen", label: "Liegend trocknen" },
  ],
  Interior: [
    { key: "feucht_abwischen", label: "Feucht abwischen" },
    { key: "trocken_reinigen", label: "Trocken abstauben" },
    { key: "keine_scheuermittel", label: "Keine Scheuermittel" },
    { key: "oelen_wachsen", label: "Regelmäßig ölen oder wachsen" },
    { key: "vor_sonne_schuetzen", label: "Vor direkter Sonne schützen" },
    { key: "nicht_draussen", label: "Nicht für den Außenbereich" },
    { key: "filzgleiter", label: "Filzgleiter verwenden" },
    { key: "polster_absaugen", label: "Polster absaugen" },
    { key: "montage_noetig", label: "Montage erforderlich" },
  ],
  Kunst: [
    { key: "vor_sonne_schuetzen", label: "Vor direktem Licht schützen" },
    { key: "nicht_beruehren", label: "Oberfläche nicht berühren" },
    { key: "staub_trocken", label: "Staub trocken abnehmen" },
    { key: "raumfeuchte", label: "Gleichmäßige Raumfeuchte" },
    { key: "nicht_feuchtraum", label: "Nicht in Feuchträumen hängen" },
    { key: "fachgerechte_reinigung", label: "Nur fachgerechte Reinigung" },
    { key: "liegend_transport", label: "Liegend transportieren" },
    { key: "handschuhe", label: "Mit Handschuhen handhaben" },
  ],
};

/** Rückwärtskompatibel: die Mode-Palette. */
export const CARE_SYMBOLS = CARE_SYMBOLS_BY_WORLD.Mode;

const ALL_CARE_SYMBOLS = Object.values(CARE_SYMBOLS_BY_WORLD).flat();

export const careLabel = (key: string): string =>
  ALL_CARE_SYMBOLS.find((c) => c.key === key)?.label ?? key;

/* ---------------- Welt-Profile: jede Welt braucht andere Angaben ---------------- */

export type ProductWorld = "Mode" | "Interior" | "Kunst";

export interface WorldProfile {
  /** Überschrift des Varianten-Abschnitts im Studio. */
  variantTitle: string;
  variantHelp: string;
  /** Einzahl, z. B. "Größe" / "Ausführung" / "Format". */
  variantSingular: string;
  variantPlaceholder: string;
  variantEmpty: string;
  /** Label über den Auswahlknöpfen auf der Produktseite. */
  variantPublicLabel: string;
  variantSoldOut: string;
  /** Maßtabelle. */
  measurementTitle: string;
  measurementRows: string[];
  measurementHint: string;
  /** Material-Abschnitt. */
  materialTitle: string;
  materialHelp: string;
  materialLabel: string;
  materialPlaceholder: string;
  /** Ob die Zusammensetzung vor dem Veröffentlichen Pflicht ist. */
  materialRequired: boolean;
  materialPublicLabel: string;
  /** Freitextfeld für Konstruktionsdetails. */
  detailLabel: string;
  detailPlaceholder: string;
  detailPublicLabel: string;
  /** Pflege/Handhabung. */
  careTitle: string;
  carePublicLabel: string;
  careSymbols: { key: string; label: string }[];
  /** Objektmaße (L×B×H). */
  dimensionsLabel: string;
  dimensionsHint: string;
  /** Herkunft und Auflage. */
  originLabel: string;
  editionLabel: string;
  editionPlaceholder: string;
  editionPublicLabel: string;
}

export const WORLD_PROFILES: Record<ProductWorld, WorldProfile> = {
  Mode: {
    variantTitle: "Größen & Maße",
    variantHelp:
      "Ein Stück kann in mehreren Größen existieren — je Größe eigener Bestand, optional Aufpreis und Artikelnummer. Ausverkaufte Größen sind im Shop nicht wählbar. Die Maßtabelle beantwortet die häufigste Frage vor dem Kauf.",
    variantSingular: "Größe",
    variantPlaceholder: "M",
    variantEmpty: "Keine Größen — dann gilt der allgemeine Bestand oben. Passt für Unikate.",
    variantPublicLabel: "Größe",
    variantSoldOut: "Diese Größe ist ausverkauft.",
    measurementTitle: "Maßtabelle (cm)",
    measurementRows: MEASUREMENT_PRESETS.Mode,
    measurementHint: "Trag zuerst mindestens eine Größe ein — dann kannst du je Größe messen.",
    materialTitle: "Material & Pflege",
    materialHelp:
      "Die Zusammensetzung ist Pflicht, damit dein Stück veröffentlicht werden kann — Käufer:innen und Gesetz erwarten sie. Die Summe sollte 100 % ergeben.",
    materialLabel: "Material",
    materialPlaceholder: "z. B. Wolle",
    materialRequired: true,
    materialPublicLabel: "Material",
    detailLabel: "Futter, Beschläge, Details (optional)",
    detailPlaceholder: "z. B. Futter aus Bemberg, Messingknöpfe",
    detailPublicLabel: "Futter & Details",
    careTitle: "Pflegehinweise",
    carePublicLabel: "Pflege",
    careSymbols: CARE_SYMBOLS_BY_WORLD.Mode,
    dimensionsLabel: "Paketmaße für den Versand (L × B × H in cm)",
    dimensionsHint: "Nur ausfüllen, was passt.",
    originLabel: "Wo gefertigt?",
    editionLabel: "Unikat oder Edition?",
    editionPlaceholder: "Unikat",
    editionPublicLabel: "Edition",
  },
  Interior: {
    variantTitle: "Ausführungen & Objektmaße",
    variantHelp:
      "Ein Objekt kann in mehreren Ausführungen existieren — etwa Holzart, Oberfläche oder Maßvariante. Je Ausführung eigener Bestand, optional Aufpreis und Artikelnummer. Die Maßtabelle darunter zeigt die Objektmaße je Ausführung.",
    variantSingular: "Ausführung",
    variantPlaceholder: "z. B. Eiche geölt",
    variantEmpty: "Keine Ausführungen — dann gilt der allgemeine Bestand oben. Passt für Einzelstücke.",
    variantPublicLabel: "Ausführung",
    variantSoldOut: "Diese Ausführung ist vergriffen.",
    measurementTitle: "Objektmaße (cm)",
    measurementRows: MEASUREMENT_PRESETS.Interior,
    measurementHint: "Trag zuerst mindestens eine Ausführung ein — dann kannst du je Ausführung messen.",
    materialTitle: "Material & Verarbeitung",
    materialHelp:
      "Woraus besteht das Objekt? Massivholz, Metall, Stein, Textil — mit Anteilen. Die Angabe ist Pflicht, weil sie über Pflege, Gewicht und Lebensdauer entscheidet.",
    materialLabel: "Werkstoff",
    materialPlaceholder: "z. B. Eiche massiv",
    materialRequired: true,
    materialPublicLabel: "Werkstoff",
    detailLabel: "Oberfläche, Beschläge, Montage (optional)",
    detailPlaceholder: "z. B. hartwachsgeölt, Messingfüße, Montage in zwei Schritten",
    detailPublicLabel: "Oberfläche & Montage",
    careTitle: "Pflege & Handhabung",
    carePublicLabel: "Pflege & Handhabung",
    careSymbols: CARE_SYMBOLS_BY_WORLD.Interior,
    dimensionsLabel: "Objektmaße (L × B × H in cm)",
    dimensionsHint: "Die tatsächlichen Maße des Objekts — Käufer:innen messen ihren Raum danach aus.",
    originLabel: "Wo gefertigt?",
    editionLabel: "Einzelstück oder Serie?",
    editionPlaceholder: "Einzelstück",
    editionPublicLabel: "Auflage",
  },
  Kunst: {
    variantTitle: "Formate & Werkmaße",
    variantHelp:
      "Eine Arbeit kann in mehreren Formaten oder Auflagenvarianten existieren — je Format eigener Bestand, optional Aufpreis und Artikelnummer. Die Maßtabelle darunter nennt Bild-, Rahmen- und Blattmaß.",
    variantSingular: "Format",
    variantPlaceholder: "z. B. 50 × 70",
    variantEmpty: "Keine Formate — dann gilt der allgemeine Bestand oben. Passt für Unikate.",
    variantPublicLabel: "Format",
    variantSoldOut: "Dieses Format ist vergriffen.",
    measurementTitle: "Werkmaße (cm)",
    measurementRows: MEASUREMENT_PRESETS.Kunst,
    measurementHint: "Trag zuerst mindestens ein Format ein — dann kannst du je Format messen.",
    materialTitle: "Technik & Material",
    materialHelp:
      "Womit ist die Arbeit entstanden? Technik und Bildträger, mit Anteilen falls mehrere. Sammler:innen erwarten diese Angabe.",
    materialLabel: "Technik / Träger",
    materialPlaceholder: "z. B. Öl auf Leinwand",
    materialRequired: true,
    materialPublicLabel: "Technik",
    detailLabel: "Rahmung, Aufhängung, Signatur (optional)",
    detailPlaceholder: "z. B. ungerahmt, rückseitig signiert und datiert",
    detailPublicLabel: "Rahmung & Signatur",
    careTitle: "Handhabung & Konservierung",
    carePublicLabel: "Handhabung",
    careSymbols: CARE_SYMBOLS_BY_WORLD.Kunst,
    dimensionsLabel: "Versandmaße der Kiste oder Rolle (L × B × H in cm)",
    dimensionsHint: "Für den Transport — die Werkmaße gehören in die Tabelle oben.",
    originLabel: "Wo entstanden?",
    editionLabel: "Unikat oder Auflage?",
    editionPlaceholder: "Unikat",
    editionPublicLabel: "Auflage",
  },
};

export function worldProfile(world: string | null | undefined): WorldProfile {
  return WORLD_PROFILES[(world as ProductWorld) ?? "Mode"] ?? WORLD_PROFILES.Mode;
}


/* ---------------- Mehrwertsteuer ---------------- */

export interface VatBreakdown {
  /** Endpreis inklusive Steuer. */
  gross: number;
  /** Nettobetrag. */
  net: number;
  /** Enthaltener Steuerbetrag. */
  vat: number;
  /** Angewandter Satz in Prozent. */
  rate: number;
}

/** Der eingetragene Preis ist immer der Endpreis inklusive Mehrwertsteuer. */
export function splitVat(gross: number, rate: number): VatBreakdown {
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 0;
  const net = safeRate > 0 ? gross / (1 + safeRate / 100) : gross;
  return {
    gross,
    net: Math.round(net * 100) / 100,
    vat: Math.round((gross - net) * 100) / 100,
    rate: safeRate,
  };
}

/** Satz eines Stücks: eigener Satz schlägt den Haus-Standard. */
export function effectiveVatRate(productRate: number | null | undefined, houseRate: number | null | undefined): number {
  if (productRate != null && Number.isFinite(Number(productRate))) return Number(productRate);
  if (houseRate != null && Number.isFinite(Number(houseRate))) return Number(houseRate);
  return 19;
}

/** Hinweiszeile unter jedem Preis — gesetzlich vorgeschrieben. Teil J1: zweisprachig, da
 * dieser Text direkt auf der öffentlichen Artikelseite erscheint. */
export function vatNote(rate: number, locale: "de" | "en" = "de"): string {
  if (locale === "en") {
    return rate > 0
      ? `incl. ${formatRate(rate)}% VAT, plus shipping`
      : "No VAT shown under §19 UStG (German small-business scheme), plus shipping";
  }
  return rate > 0
    ? `inkl. ${formatRate(rate)} % MwSt., zzgl. Versand`
    : "Kein Ausweis der Umsatzsteuer nach § 19 UStG (Kleinunternehmerregelung), zzgl. Versand";
}

export function formatRate(rate: number): string {
  return String(Math.round(rate * 100) / 100).replace(".", ",");
}

export function formatEuro(v: number): string {
  return v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ---------------- Größen ---------------- */

export function totalStock(sizes: SizeVariant[] | null | undefined, fallback: number): number {
  if (!sizes || sizes.length === 0) return fallback;
  return sizes.reduce((s, v) => s + Math.max(0, Number(v.stock) || 0), 0);
}

export function materialSum(parts: MaterialPart[] | null | undefined): number {
  return (parts ?? []).reduce((s, p) => s + (Number(p.percent) || 0), 0);
}

export function materialLine(parts: MaterialPart[] | null | undefined): string {
  return (parts ?? [])
    .filter((p) => p.material.trim())
    .map((p) => `${formatRate(Number(p.percent) || 0)} % ${p.material.trim()}`)
    .join(" · ");
}
