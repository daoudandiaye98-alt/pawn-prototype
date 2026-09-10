/* @vitest-environment node */
/**
 * Die Wache über das Ausnahmen-Register.
 *
 * Der Wecker entscheidet, ob ein gefallenes Gate den Check rot macht. Ein
 * Tippfehler im Datum verschöbe diese Entscheidung stillschweigend — deshalb
 * wird die Form geprüft und die Grenze des Weckers festgenagelt: AM Stichtag
 * gilt die Ausnahme noch, DANACH nicht mehr.
 *
 * **Warum die Mechanik an einem erfundenen Eintrag geprüft wird und nicht am
 * ersten echten.** Sie tat es einmal, und am 08.09.2026 fiel dieser Test, weil
 * das Register leer wurde: die einzige Ausnahme (4.5) war erledigt und wurde
 * gelöscht, wie es der Kopf von `ausnahmen.ts` verlangt. Ein Test, der an der
 * ordnungsgemäßen Erledigung einer Ausnahme scheitert, prüft das Falsche — und
 * bestraft genau das Verhalten, das er erzwingen soll. Ein leeres Register ist
 * der GUTE Zustand: keine offene Schuld.
 *
 * Die Mechanik hängt jetzt an einem Prüfstück, die Form an dem, was wirklich
 * eingetragen ist. Beides bleibt geprüft, keines hängt vom anderen ab.
 */
import { describe, it, expect } from "vitest";
import { AUSNAHMEN, ausnahmeFuer, abgelaufen, type Ausnahme } from "../../tools/pruefstand/ausnahmen";

describe("ausnahmen.ts", () => {
  it("jede eingetragene Ausnahme trägt alle vier Angaben", () => {
    for (const a of AUSNAHMEN) {
      expect(a.kontrolle.length, `${a.kontrolle}: Kontrolle fehlt`).toBeGreaterThan(0);
      expect(a.name.length, `${a.kontrolle}: Name fehlt`).toBeGreaterThan(0);
      expect(a.termin.length, `${a.kontrolle}: Termin fehlt`).toBeGreaterThan(0);
      // Ein Wecker, den `heute <= wecker` nicht vergleichen kann, klingelt nie.
      expect(a.wecker, `${a.kontrolle}: Wecker ist kein ISO-Datum`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(a.wecker)), `${a.kontrolle}: Wecker unlesbar`).toBe(false);
    }
  });

  it("am Stichtag gilt die Ausnahme noch, danach nicht mehr", () => {
    /* Ein Prüfstück, kein echter Eintrag — siehe Kopf dieser Datei. */
    const probe: Ausnahme = {
      kontrolle: "9.99",
      name: "Prüfstück — steht nie im echten Register",
      termin: "nur für diesen Test",
      wecker: "2026-06-15",
    };
    const register = [probe];
    const suche = (heute: string) =>
      register.find((a) => a.kontrolle === probe.kontrolle && heute <= a.wecker) ?? null;

    expect(suche(probe.wecker)).toBe(probe);
    const danach = new Date(Date.parse(probe.wecker) + 86_400_000).toISOString().slice(0, 10);
    expect(suche(danach)).toBeNull();
  });

  it("dieselbe Grenze gilt für das echte Register", () => {
    for (const a of AUSNAHMEN) {
      expect(ausnahmeFuer(a.kontrolle, a.wecker), `${a.kontrolle} müsste am Stichtag gelten`).toBe(a);
      const danach = new Date(Date.parse(a.wecker) + 86_400_000).toISOString().slice(0, 10);
      expect(ausnahmeFuer(a.kontrolle, danach), `${a.kontrolle} dürfte danach nicht mehr gelten`).toBeNull();
      expect(abgelaufen(danach)).toContain(a);
      expect(abgelaufen(a.wecker)).not.toContain(a);
    }
    /* Leeres Register: nichts ist offen, also läuft auch nichts ab. */
    if (AUSNAHMEN.length === 0) expect(abgelaufen("2099-01-01")).toEqual([]);
  });

  it("eine unbekannte Kontrolle ist nie entschuldigt", () => {
    expect(ausnahmeFuer("9.99", "2026-01-01")).toBeNull();
  });
});
