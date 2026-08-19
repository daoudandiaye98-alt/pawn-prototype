/**
 * Teil B0 — es gibt genau drei Easing-Kurven, und sie stehen an einer Stelle.
 *
 * Die Regel ist keine Stilfrage. Eine Site, deren Bewegungen aus zwölf
 * verstreuten Kurven kommen, fühlt sich an wie zwölf Sites. Wer eine vierte
 * Kurve braucht, hat die Bewegung falsch entworfen — nicht zu wenig Werkzeug.
 *
 * Diese Wache ist die Abnahmeregel aus B0, als Test geschrieben: sie ist die
 * Fundstelle, nicht der Haken.
 */
import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const wurzel = resolve(__dirname, "..", "..");

describe("Teil B0 — drei Kurven, sonst keine", () => {
  it("kein cubic-bezier außerhalb von bewegung.css", () => {
    const wort = "cubic" + "-bezier";
    const treffer = execSync(
      `grep -rn "${wort}" src/ | grep -v "bewegung.css" || true`,
      { cwd: wurzel, encoding: "utf8" },
    ).trim();
    expect(treffer, `Kurve(n) außerhalb der Tokens:\n${treffer}`).toBe("");
  });

  it("bewegung.css führt genau drei Kurven", () => {
    const css = readFileSync(resolve(wurzel, "src/styles/bewegung.css"), "utf8");
    /* Das Wort wird zusammengesetzt und steht nirgends ganz in dieser Datei —
       sonst fände der Abnahme-Befehl aus B0 diese Wache selbst und meldete
       einen Treffer, den es nicht gibt. */
    const muster = new RegExp("cubic" + "-bezier\\([^)]*\\)", "g");
    const kurven = [...css.matchAll(muster)].map((m) => m[0]);
    expect(kurven).toHaveLength(3);
    expect(new Set(kurven).size, "zwei Namen, dieselbe Kurve").toBe(3);
  });

  it("führt alle Zahlen, die B0 nennt", () => {
    const css = readFileSync(resolve(wurzel, "src/styles/bewegung.css"), "utf8");
    for (const name of [
      "--kurve-standard", "--kurve-fein", "--kurve-dramatisch",
      "--dauer-mikro", "--dauer-hover", "--dauer-block", "--dauer-szene",
      "--staffel-wort", "--staffel-zeichen", "--staffel-karte", "--lerp",
    ]) {
      expect(css, `${name} fehlt`).toContain(`${name}:`);
    }
  });
});
