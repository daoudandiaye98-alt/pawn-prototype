/* @vitest-environment node */
/**
 * Die Wache über das Ausnahmen-Register.
 *
 * Der Wecker entscheidet, ob ein gefallenes Gate den Check rot macht. Ein
 * Tippfehler im Datum verschöbe diese Entscheidung stillschweigend — deshalb
 * wird die Form geprüft und die Grenze des Weckers festgenagelt: AM Stichtag
 * gilt die Ausnahme noch, DANACH nicht mehr.
 */
import { describe, it, expect } from "vitest";
import { AUSNAHMEN, ausnahmeFuer, abgelaufen } from "../../tools/pruefstand/ausnahmen";

describe("ausnahmen.ts", () => {
  it.each(AUSNAHMEN.map((a) => [a.kontrolle, a]))("%s trägt alle vier Angaben", (_k, a) => {
    expect(a.kontrolle.length).toBeGreaterThan(0);
    expect(a.name.length).toBeGreaterThan(0);
    expect(a.termin.length).toBeGreaterThan(0);
    // Ein Wecker, den `heute <= wecker` nicht vergleichen kann, klingelt nie.
    expect(a.wecker).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(a.wecker))).toBe(false);
  });

  it("am Stichtag gilt die Ausnahme noch, danach nicht mehr", () => {
    const a = AUSNAHMEN[0];
    expect(ausnahmeFuer(a.kontrolle, a.wecker)).toBe(a);
    const danach = new Date(Date.parse(a.wecker) + 86_400_000).toISOString().slice(0, 10);
    expect(ausnahmeFuer(a.kontrolle, danach)).toBeNull();
    expect(abgelaufen(danach)).toContain(a);
    expect(abgelaufen(a.wecker)).not.toContain(a);
  });

  it("eine unbekannte Kontrolle ist nie entschuldigt", () => {
    expect(ausnahmeFuer("9.99", "2026-01-01")).toBeNull();
  });
});
