/**
 * Passform-Assistent: reine Rechenregeln, keine KI, keine Kosten.
 * Vergleicht die hinterlegten Körpermaße einer Kundin oder eines Kunden mit der
 * Maßtabelle eines Hauses — denn „M" heißt bei jedem Haus etwas anderes.
 */
import type { Measurements } from "@/features/studio/productDetails";

export type FitPreference = "eng" | "gerade" | "weit";

export interface BodyMeasurements {
  height_cm: number | null;
  shoulder_cm: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  inseam_cm: number | null;
  foot_cm: number | null;
  fit_preference: FitPreference;
  room_note: string | null;
}

export const emptyBody = (): BodyMeasurements => ({
  height_cm: null,
  shoulder_cm: null,
  chest_cm: null,
  waist_cm: null,
  hip_cm: null,
  inseam_cm: null,
  foot_cm: null,
  fit_preference: "gerade",
  room_note: null,
});

export interface BodyField {
  key: keyof Pick<BodyMeasurements, "height_cm" | "shoulder_cm" | "chest_cm" | "waist_cm" | "hip_cm" | "inseam_cm" | "foot_cm">;
  label: string;
  hint: string;
}

export const BODY_FIELDS: BodyField[] = [
  { key: "height_cm", label: "Körpergröße", hint: "Ohne Schuhe, in Zentimetern." },
  { key: "shoulder_cm", label: "Schulterbreite", hint: "Von Schulterpunkt zu Schulterpunkt über den Rücken." },
  { key: "chest_cm", label: "Brustumfang", hint: "An der breitesten Stelle, locker anliegend." },
  { key: "waist_cm", label: "Taillenumfang", hint: "An der schmalsten Stelle." },
  { key: "hip_cm", label: "Hüftumfang", hint: "An der breitesten Stelle." },
  { key: "inseam_cm", label: "Innenbeinlänge", hint: "Vom Schritt bis zum Knöchel." },
  { key: "foot_cm", label: "Fußlänge", hint: "Ferse bis längster Zeh." },
];

export const FIT_PREFERENCES: { key: FitPreference; label: string; description: string }[] = [
  { key: "eng", label: "Eng", description: "Nah am Körper." },
  { key: "gerade", label: "Gerade", description: "Klassisch, mit etwas Luft." },
  { key: "weit", label: "Weit", description: "Volumen, bewusst überschnitten." },
];

/** Wie viel Luft (Zentimeter) zwischen Körper und Stück angenehm ist. */
const EASE_RANGE: Record<FitPreference, { min: number; max: number }> = {
  eng: { min: 0, max: 8 },
  gerade: { min: 3, max: 14 },
  weit: { min: 8, max: 30 },
};

/** Welche Zeile der Maßtabelle welchem Körpermaß entspricht. */
const ROW_TO_BODY: { match: RegExp; key: keyof BodyMeasurements; kind: "umfang" | "laenge" }[] = [
  { match: /brust/i, key: "chest_cm", kind: "umfang" },
  { match: /taille/i, key: "waist_cm", kind: "umfang" },
  { match: /(h(ü|ue)ft|bund)/i, key: "hip_cm", kind: "umfang" },
  { match: /schulter/i, key: "shoulder_cm", kind: "laenge" },
  { match: /(innenbein|schritt)/i, key: "inseam_cm", kind: "laenge" },
];

export type FitLevel = "passt" | "knapp" | "weit" | "unbekannt";

export interface SizeFit {
  size: string;
  level: FitLevel;
  /** Ein Satz Klartext, z. B. „Brust +4 cm Spielraum". */
  reason: string;
}

export interface FitResult {
  /** Nichts zu rechnen — keine Maße hinterlegt oder keine Maßtabelle. */
  possible: boolean;
  sizes: SizeFit[];
  best: SizeFit | null;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function hasAnyBodyValue(body: BodyMeasurements | null): boolean {
  if (!body) return false;
  return BODY_FIELDS.some((f) => num(body[f.key]) !== null);
}

/**
 * Vergleicht Körpermaße mit der Maßtabelle. Umfangszeilen werden als Umfang des
 * Stücks gelesen, Längenzeilen (Schulter, Innenbein) als direkter Vergleich.
 */
export function computeFit(
  body: BodyMeasurements | null,
  measurements: Measurements | null,
  sizes: string[],
): FitResult {
  if (!body || !measurements || measurements.rows.length === 0 || sizes.length === 0) {
    return { possible: false, sizes: [], best: null };
  }
  const relevant = ROW_TO_BODY.map((r) => {
    const row = measurements.rows.find((x) => r.match.test(x));
    const bodyValue = num(body[r.key]);
    return row && bodyValue ? { row, bodyValue, kind: r.kind } : null;
  }).filter((x): x is { row: string; bodyValue: number; kind: "umfang" | "laenge" } => x !== null);

  if (relevant.length === 0) return { possible: false, sizes: [], best: null };

  const range = EASE_RANGE[body.fit_preference] ?? EASE_RANGE.gerade;

  const result: SizeFit[] = sizes.map((size) => {
    let worst: { level: FitLevel; reason: string; distance: number } | null = null;
    let anyValue = false;

    for (const r of relevant) {
      const garment = num(measurements.values?.[r.row]?.[size]);
      if (garment === null) continue;
      anyValue = true;
      const ease = Math.round((garment - r.bodyValue) * 10) / 10;
      const tolerance = r.kind === "laenge" ? { min: -2, max: 4 } : range;
      let level: FitLevel = "passt";
      let distance = 0;
      if (ease < tolerance.min) { level = "knapp"; distance = tolerance.min - ease; }
      else if (ease > tolerance.max) { level = "weit"; distance = ease - tolerance.max; }

      const label = r.row.toLowerCase();
      const reason = level === "passt"
        ? `${r.row} ${ease >= 0 ? "+" : ""}${ease} cm Spielraum`
        : level === "knapp"
        ? `zu knapp an der ${label} (${ease} cm)`
        : `sehr weit an der ${label} (+${ease} cm)`;

      if (!worst || distance > worst.distance) worst = { level, reason, distance };
    }

    if (!anyValue || !worst) return { size, level: "unbekannt", reason: "Für diese Größe fehlen Maße." };
    return { size, level: worst.level, reason: worst.reason };
  });

  const best = result.find((r) => r.level === "passt") ?? null;
  return { possible: true, sizes: result, best };
}
