/**
 * Die Spalten, die das Heft abfragt, muss es in der Datenbank geben.
 *
 * **Warum es diese Wache gibt.** Das Verzeichnis fragte `designers (
 * kauf_freigeschaltet )` ab — eine Spalte, die nie existiert hat. PostgREST
 * antwortete mit 400 (PostgreSQL 42703), der Hook fing den Fehler ab und zeigte
 * „Die Stücke sind da, die Leitung nicht." Auf live sah das aus wie ein
 * Netzproblem und war ein Tippfehler. Kein Typecheck konnte das finden: der
 * Auswahl-Ausdruck ist eine Zeichenkette.
 *
 * Diese Wache liest die Zeichenketten und vergleicht sie mit `types.ts` — der
 * Datei, die aus dem echten Schema erzeugt wird. Sie kostet nichts und hätte
 * den Ausfall am Tag seiner Entstehung gemeldet.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const lies = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

/** Die Spalten einer Tabelle, wie der Generator sie in `types.ts` geschrieben hat. */
function spaltenAus(tabelle: string): Set<string> {
  const t = lies("integrations/supabase/types.ts");
  const start = t.indexOf(`      ${tabelle}: {`);
  expect(start, `Tabelle ${tabelle} steht nicht in types.ts`).toBeGreaterThan(-1);
  const rowStart = t.indexOf("Row: {", start);
  const rowEnde = t.indexOf("\n        }", rowStart);
  const block = t.slice(rowStart, rowEnde);
  const namen = new Set<string>();
  for (const zeile of block.split("\n").slice(1)) {
    const m = zeile.match(/^\s{10}([a-z0-9_]+)(\??):/);
    if (m) namen.add(m[1]);
  }
  expect(namen.size, `keine Spalten für ${tabelle} gelesen`).toBeGreaterThan(3);
  return namen;
}

/**
 * Die Spalten aus einem `.select(...)`-Ausdruck.
 *
 * Eingebettete Tabellen (`designers ( a, b )`) werden getrennt zurückgegeben,
 * weil sie gegen eine andere Tabelle geprüft werden müssen — genau dort saß der
 * Fehler.
 */
function auswahlAus(quelle: string): { eigen: string[]; fremd: Record<string, string[]> } {
  const roh = quelle.replace(/\s+/g, " ");
  const fremd: Record<string, string[]> = {};
  const ohneJoins = roh.replace(/([a-z_]+)\s*\(([^)]*)\)/g, (_, tabelle: string, inhalt: string) => {
    fremd[tabelle] = inhalt.split(",").map((s) => s.trim()).filter(Boolean);
    return "";
  });
  return { eigen: ohneJoins.split(",").map((s) => s.trim()).filter(Boolean), fremd };
}

/**
 * Holt den Text einer `.select("…")`-Kette, auch über mehrere Zeilen geklebt.
 *
 * Die Klammer wird gezählt, nicht geraten. Mein erster Versuch suchte die
 * schließende Klammer mit ineinandergeschachtelten `indexOf` — er fand eine
 * falsche Stelle, und die Wache ging grün durch, obwohl der echte Fehler wieder
 * im Quelltext stand. Eine Wache, die man nicht gegengeprüft hat, ist keine.
 */
function selectAus(datei: string, nach: string): string {
  const t = lies(datei);
  const ab = t.indexOf(nach);
  expect(ab, `${nach} nicht in ${datei}`).toBeGreaterThan(-1);
  const sel = t.indexOf(".select(", ab);
  expect(sel, `kein .select nach ${nach} in ${datei}`).toBeGreaterThan(-1);
  let tiefe = 0;
  let ende = sel;
  for (let i = sel + ".select".length; i < t.length; i++) {
    if (t[i] === "(") tiefe++;
    else if (t[i] === ")") { tiefe--; if (tiefe === 0) { ende = i; break; } }
  }
  const stueck = t.slice(sel, ende);
  const teile = [...stueck.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  expect(teile.length, `kein Auswahl-Text in ${datei}`).toBeGreaterThan(0);
  return teile.join("");
}

describe("Abgefragte Spalten gibt es wirklich", () => {
  it("Verzeichnis: products samt eingebettetem designers", () => {
    const { eigen, fremd } = auswahlAus(selectAus("heft/verzeichnis.tsx", 'from("products")'));
    const p = spaltenAus("products");
    for (const s of eigen) expect(p, `products.${s} gibt es nicht`).toContain(s);
    const d = spaltenAus("designers");
    for (const s of fremd.designers ?? []) expect(d, `designers.${s} gibt es nicht`).toContain(s);
  });

  it("Häuser-Kapitel: designers", () => {
    const { eigen } = auswahlAus(selectAus("heft/haeuser.tsx", 'from("designers")'));
    const d = spaltenAus("designers");
    for (const s of eigen) expect(d, `designers.${s} gibt es nicht`).toContain(s);
  });
});
