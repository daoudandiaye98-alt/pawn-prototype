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
  Interior: ["Breite", "Tiefe", "Höhe", "Sitzhöhe"],
  Kunst: ["Breite", "Höhe", "Tiefe", "Rahmenmaß"],
};

export const CARE_SYMBOLS: { key: string; label: string }[] = [
  { key: "handwaesche", label: "Handwäsche" },
  { key: "maschine_30", label: "Maschinenwäsche 30°" },
  { key: "nicht_bleichen", label: "Nicht bleichen" },
  { key: "nicht_trockner", label: "Nicht in den Trockner" },
  { key: "buegeln_niedrig", label: "Bügeln niedrig" },
  { key: "nicht_buegeln", label: "Nicht bügeln" },
  { key: "chemische_reinigung", label: "Chemische Reinigung" },
  { key: "liegend_trocknen", label: "Liegend trocknen" },
];

export const careLabel = (key: string): string =>
  CARE_SYMBOLS.find((c) => c.key === key)?.label ?? key;

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

/** Hinweiszeile unter jedem Preis — gesetzlich vorgeschrieben. */
export function vatNote(rate: number): string {
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
