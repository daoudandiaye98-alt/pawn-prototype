/**
 * Welche Adressen dem Heft gehören — für die Hülle, nicht für das Heft.
 *
 * Das Heft kennt seine Adressen selbst (`routen.mjs › alleAdressen()`), aber diese Liste
 * hängt an `data.mjs` und damit am ganzen Heft. `App.tsx` liegt im Haupt-Bündel und darf
 * das nicht nachziehen — wer nie blättert, soll den Wendel nie laden. Deshalb steht hier
 * eine kurze, eigene Liste ohne Importe.
 *
 * Zwei Listen, eine Wahrheit: `src/__tests__/heft03-adressen.spec.ts` hält sie gegen die
 * Routen, die `App.tsx` an `HeftRoute03` gibt. Wer eine Sektion hinzufügt und diese Datei
 * vergisst, sieht einen roten Test — nicht eine Einwilligungsleiste, die plötzlich mitten
 * im Heft steht.
 */

/** Adressen ohne weitere Abschnitte. */
const GENAU = new Set([
  "/",
  "/ausgewaehlt",
  "/tasche",
  "/suche",
  "/frag-pawn",
]);

/** Erste Abschnitte, deren Unterseiten alle dem Heft gehören (`/mode/2`, `/haus/lind/3`). */
const STAEMME = [
  "mode",
  "interior",
  "kunst",
  "haeuser",
  "haus",
  "werk",
  "deine-dna",
  "vision",
  "fuer-designer",
  "konto",
];

/** Gehört diese Adresse dem Heft? Fragezeichen und Schrägstrich am Ende zählen nicht mit. */
export function istHeftAdresse(pfad: string): boolean {
  const rein = (pfad.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  if (GENAU.has(rein)) return true;
  const stamm = rein.split("/").filter(Boolean)[0];
  return !!stamm && STAEMME.includes(stamm);
}
