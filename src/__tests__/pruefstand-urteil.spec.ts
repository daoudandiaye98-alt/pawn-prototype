/**
 * @vitest-environment node
 *
 * Die Wache über die Frage, ob ein Prüfstandslauf überhaupt etwas gesehen hat.
 *
 * **Der belegte Fall.** Lauf #104 (10.09.2026, Kopf 42c1dc0) meldete grün und
 * hatte dabei `1 bestanden · 0 gefallen · 673 nicht prüfbar` gemessen: Chromium
 * auf dem Runner löste `rnakubexbqfgfciynqpt.supabase.co` nicht auf, die Seiten
 * kamen als Hülle an. Null gefallene Gates — also grün. Ein Häkchen über 673
 * ungemessenen Prüfungen.
 *
 * `.claude/rules/00-gesetze.md` nennt den einen Fehler: eine Prüfung, die an
 * rechtmäßigem Code rot wird, lehrt Rot zu übersehen. Dies hier ist der andere,
 * und er ist schlimmer, weil er sich wie ein Beleg anfühlt: eine Prüfung, die
 * grün meldet, ohne gemessen zu haben, lehrt **Grün zu glauben**.
 *
 * Die Rechnung steht in `tools/pruefstand/urteil.ts`, nicht in `lauf.ts`, damit
 * sie ohne Browser prüfbar ist — `tools/` liegt außerhalb von
 * `tsconfig.app.json`, und der Lauf selbst braucht ein Netz und ein Ziel.
 *
 * Node-Umgebung wie bei `pruefstand-parst.spec.ts`: der Prüfstand läuft in Node,
 * hier wird gemessen, was dort gilt.
 */
import { describe, it, expect } from "vitest";
import { urteilsfaehig, MINDESTANTEIL, KEIN_URTEIL } from "../../tools/pruefstand/urteil";

describe("Trägt der Lauf ein Urteil?", () => {
  it("erkennt den belegten Fall #104 als kein Urteil", () => {
    // Die echten Zahlen aus Lauf #104. Diese Zeile ist der Grund für die Datei.
    const u = urteilsfaehig({ bestanden: 1, gefallen: 0, nicht_pruefbar: 673 });
    expect(u.urteil).toBe(false);
    expect(u.gemessen).toBe(1);
    expect(u.gesamt).toBe(674);
    // Der Grund muss die Zahlen nennen — „kein Urteil" allein ist keine Auskunft.
    expect(u.grund).toContain("1 von 674");
    expect(u.grund).toContain("Die übrigen 673");
  });

  it("nennt einen vollständig gemessenen Lauf ein Urteil", () => {
    const u = urteilsfaehig({ bestanden: 600, gefallen: 0, nicht_pruefbar: 0 });
    expect(u.urteil).toBe(true);
    expect(u.anteil).toBe(1);
  });

  it("entwertet einen Lauf nicht wegen einzelner nicht prüfbarer Gates", () => {
    /* Das ist der Normalfall, nicht die Ausnahme: eine gesperrte Seite, ein Ziel
       ohne 404-Kopfzeile. Würde das schon „kein Urteil" heißen, wäre die neue
       Schwelle selbst die Prüfung, die grundlos anschlägt — genau das, was
       00-gesetze.md verbietet. */
    const u = urteilsfaehig({ bestanden: 640, gefallen: 2, nicht_pruefbar: 32 });
    expect(u.urteil).toBe(true);
  });

  it("urteilt auch über einen Teillauf, wenn er messbar war", () => {
    // `--kontrollen 4.7` misst wenige Gates — wenige heißt nicht blind.
    const u = urteilsfaehig({ bestanden: 6, gefallen: 0, nicht_pruefbar: 0 });
    expect(u.urteil).toBe(true);
  });

  it("schreibt die Einzahl richtig — der Satz wird gelesen, nicht geparst", () => {
    /* Zweimal aufgefallen, beide Male am echten Satz und nicht im Diff:
       1. lokal: „Die übrigen 1 blieben …"
       2. auf dem Runner (Lauf #106): „Nur 1 von 1104 Gates WAREN messbar" —
          das Subjekt ist die 1, also „war".
       Das Verb ist darum ganz weg: es hinge an beiden Zahlen, und jede
       Beugungsregel wäre eine weitere Stelle, die falsch klingen kann. */
    const einer = urteilsfaehig({ bestanden: 0, gefallen: 0, nicht_pruefbar: 1 });
    expect(einer.grund).toContain("0 von 1 Gate messbar");
    expect(einer.grund).toContain("Das übrige blieb");

    const runner = urteilsfaehig({ bestanden: 1, gefallen: 0, nicht_pruefbar: 1103 });
    expect(runner.grund).toContain("1 von 1104 Gates messbar");
    expect(runner.grund).toContain("Die übrigen 1103");

    // Kein Satz trägt noch ein gebeugtes Verb, an dem er falsch werden könnte.
    for (const u of [einer, runner]) {
      expect(u.grund).not.toContain("waren messbar");
      expect(u.grund).not.toContain("war messbar");
    }
  });

  it("urteilt nicht über einen Lauf ohne ein einziges Gate", () => {
    // Sonst wäre ein abgebrochener Lauf ein stiller Freispruch.
    const u = urteilsfaehig({ bestanden: 0, gefallen: 0, nicht_pruefbar: 0 });
    expect(u.urteil).toBe(false);
    expect(u.anteil).toBe(0);
  });

  it("liegt die Schwelle genau auf der Hälfte, zählt sie als Urteil", () => {
    /* Die Grenze selbst wird geprüft, nicht nur ihre Umgebung: `<` gegen `<=`
       ist der klassische Fehler, den niemand im Diff sieht. */
    const genau = urteilsfaehig({ bestanden: 50, gefallen: 0, nicht_pruefbar: 50 });
    expect(genau.anteil).toBe(MINDESTANTEIL);
    expect(genau.urteil).toBe(true);

    const knappDarunter = urteilsfaehig({ bestanden: 49, gefallen: 0, nicht_pruefbar: 51 });
    expect(knappDarunter.urteil).toBe(false);
  });

  it("zählt ein gefallenes Gate als gemessen", () => {
    /* Ein Befund IST eine Messung. Würde `gefallen` nicht mitzählen, könnte ein
       Lauf mit lauter Befunden als „nichts gesehen" gelten — und der Workflow
       würde den einen Fall grün melden, der es am wenigsten verdient. */
    const u = urteilsfaehig({ bestanden: 0, gefallen: 400, nicht_pruefbar: 0 });
    expect(u.urteil).toBe(true);
    expect(u.gemessen).toBe(400);
  });

  it("hält den Rückgabewert 3 frei von den bestehenden", () => {
    // 0 bestanden · 1 Gate gefallen · 2 falsches Ziel. 3 muss daneben liegen.
    expect(KEIN_URTEIL).toBe(3);
    expect([0, 1, 2]).not.toContain(KEIN_URTEIL);
  });
});
