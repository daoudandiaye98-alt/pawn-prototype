/**
 * DIE DECKUNG — eine Umsetzung, zwei Leser (stapel.mjs und doppelungen.mjs).
 *
 * Fünf Migrationen legen Dinge an, die eine ANDERE Migration der Kette schon
 * anlegt. Die Kette bricht dort mit 42P07 (Tabelle existiert schon) oder 42710
 * (Policy existiert schon). Welche Fassung läuft und welche nur gebucht wird, steht
 * in scripts/db/deckung.json — mit Begründung je Version, denn die Wahl ist nicht
 * beliebig: manche Fassung trägt GRANTs, die der anderen fehlen.
 *
 * KEINE MIGRATION WIRD GEÄNDERT. Die Deckung wirkt nur auf das, was der
 * Stapel-Drucker an die Datenbank schickt.
 */
import { readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DECKUNG = JSON.parse(
  readFileSync(join(WURZEL, "scripts/db/deckung.json"), "utf8")).versionen;

export const version = (datei) => datei.slice(0, datei.indexOf("_"));

/** Was von einer Datei wirklich an die Datenbank geht. Leerer String = nur buchen. */
export function wirksam(datei, sql) {
  const d = DECKUNG[version(datei)];
  if (!d) return sql;
  if (d.art === "ganz") return "";
  if (d.art === "abschnitte") {
    // Das Bündel trägt seine Abschnittsgrenzen selbst: `-- Datei N: <dateiname>`.
    const stellen = [...sql.matchAll(/^-- Datei \d+: (\S+)$/gm)];
    if (!stellen.length) throw new Error(`${datei}: keine Abschnittsmarken gefunden`);
    let aus = "";
    for (const [i, m] of stellen.entries()) {
      const bis = i + 1 < stellen.length ? stellen[i + 1].index : sql.length;
      if (!d.weglassen.includes(m[1])) aus += sql.slice(m.index, bis);
    }
    if (!aus.trim()) throw new Error(`${datei}: die Deckung laesst nichts uebrig`);
    return aus;
  }
  if (d.art === "anweisung") {
    const t = d.weglassen_text;
    const treffer = sql.split(t).length - 1;
    if (treffer !== 1)
      throw new Error(`${datei}: der zu deckende Text kommt ${treffer}x vor, erwartet genau 1x`);
    return sql.replace(t, "-- (diese Anweisung ist gedeckt, siehe scripts/db/deckung.json)");
  }
  throw new Error(`${datei}: unbekannte Deckungsart ${d.art}`);
}
