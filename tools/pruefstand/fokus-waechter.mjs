#!/usr/bin/env node
/**
 * Teil K2 — der Fokus-Wächter.
 *
 * Die Grundregel steht in `src/index.css`: jedes bedienbare Element bekommt bei
 * Tastatur-Fokus einen 2-px-Rahmen in `currentColor` — schwarz auf weißem Grund,
 * weiß auf schwarzem. Sie steht in der Basis-Schicht und wird deshalb von jeder
 * Tailwind-Klasse überstimmt. Ein einziges `focus:outline-none` in einer
 * className genügt, um an dieser Stelle den Fokus unsichtbar zu machen — ohne
 * dass es jemandem auffällt, weil man es mit der Maus nie sieht.
 *
 * Dieser Wächter sucht genau das: eine Unterdrückung OHNE Ersatz. Er ist keine
 * Messung — er verhindert nur, dass wieder eine dazukommt. Was gemessen wird,
 * misst Kontrolle 3.4 im Prüfstand, an der echten Seite.
 *
 * Aufruf:  node tools/pruefstand/fokus-waechter.mjs
 * Endet mit Code 1, sobald ein neuer Fund dazukommt.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Was als Ersatz gilt: die Stelle nimmt den Rahmen weg UND setzt an derselben
 * Stelle eine eigene sichtbare Marke — als Tailwind-Klasse (`focus-visible:…`,
 * `focus:ring-…`, `focus:border-…`) oder als richtige CSS-Regel daneben
 * (`border-color:`, `box-shadow:`). Ob diese Marke stark genug ist, entscheidet
 * die Messung 3.4 am echten Bild, nicht dieser Wächter.
 */
const ERSATZ = /focus-visible:|focus:ring|focus:border|focus:outline-\[|focus:shadow|border-color:|box-shadow:/;
const FUND = /outline-none|outline:\s*none/;

/**
 * Zwei Ausnahmen, beide mit eigenem Fokus-Bild an anderer Stelle — deshalb hier
 * bewusst erlaubt, nicht übersehen:
 *
 *   Editable.tsx      → `.pawn-editable:focus` in index.css setzt einen eigenen
 *                       1,5-px-Rahmen samt Offset.
 *   Shop.tsx (Regler) → das Feld ist 44 px hoch und liegt über der ganzen Breite;
 *                       ein Rahmen darum zeigte nicht, welcher der beiden Griffe
 *                       am Zug ist. Die Marke sitzt deshalb am Griff selbst
 *                       (`:focus-visible::-webkit-slider-thumb`).
 */
const AUSNAHMEN = [
  "src/components/palace/Editable.tsx",
  "src/pages/Shop.tsx",
  // Fremdteile (shadcn/ui): dort steht `focus:outline-none` durchgehend
  // zusammen mit `focus-visible:ring-*` in derselben Zeile oder direkt daneben.
  "src/components/ui/",
];

function dateien(wurzel) {
  const raus = [];
  for (const name of readdirSync(wurzel)) {
    const pfad = join(wurzel, name);
    if (statSync(pfad).isDirectory()) { raus.push(...dateien(pfad)); continue; }
    if (/\.(tsx?|css)$/.test(name)) raus.push(pfad);
  }
  return raus;
}

const funde = [];
for (const pfad of dateien("src")) {
  if (AUSNAHMEN.some((a) => pfad.startsWith(a))) continue;
  readFileSync(pfad, "utf8").split("\n").forEach((zeile, i) => {
    if (!FUND.test(zeile) || ERSATZ.test(zeile)) return;
    funde.push(`${pfad}:${i + 1}  ${zeile.trim().slice(0, 120)}`);
  });
}

if (funde.length === 0) {
  console.log("Fokus-Wächter: keine unbeantwortete Fokus-Unterdrückung.");
  process.exit(0);
}

console.error(
  `Fokus-Wächter: ${funde.length} Stelle(n) nehmen den Tastatur-Rahmen weg, ohne einen zu setzen.\n`
  + "Entweder `focus:outline-none` streichen (dann greift die Grundregel aus index.css),\n"
  + "oder an derselben Stelle einen eigenen sichtbaren Fokus setzen.\n",
);
for (const f of funde) console.error("  " + f);
process.exit(1);
