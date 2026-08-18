/**
 * @vitest-environment node
 *
 * Die Wache über das Messgerät.
 *
 * **Warum es sie gibt.** Am 18.08.2026 ging ein Syntaxfehler in
 * `tools/pruefstand/lauf.ts` in die Auslieferung — ein `"` mitten in einer
 * Zeichenkette. Zwei Läufe brachen daran ab, bevor sie irgendetwas gemessen
 * hatten, und der Fehler sah im Protokoll aus wie ein gefallenes Gate.
 *
 * Möglich war das, weil `tsconfig.app.json` nur `src` einschließt: `npx tsc`
 * sieht `tools/` überhaupt nicht. Der Prüfstand prüft die Seite, aber nichts
 * prüfte den Prüfstand.
 *
 * Diese Datei schließt die Lücke mit demselben Parser, der im Lauf arbeitet —
 * esbuild, über `tsx`. Kein Typcheck (dafür fehlt die Projektkonfiguration),
 * sondern die Frage, die zählt: lässt sich die Datei überhaupt lesen?
 *
 * Läuft ausdrücklich in der Node-Umgebung: esbuild bricht unter jsdom ab, weil
 * dessen `TextEncoder` kein echtes `Uint8Array` liefert. Der Prüfstand läuft
 * ohnehin in Node — hier wird gemessen, was dort gilt.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { transform } from "esbuild";

const ORDNER = resolve(process.cwd(), "tools/pruefstand");
const DATEIEN = readdirSync(ORDNER).filter((d) => d.endsWith(".ts"));

describe("Der Prüfstand selbst", () => {
  it("hat überhaupt Dateien zu prüfen", () => {
    // Ohne diese Zusage wäre ein leerer Ordner ein stiller Freispruch.
    expect(DATEIEN.length).toBeGreaterThan(0);
  });

  it.each(DATEIEN.map((d) => [d]))("%s ist lesbarer TypeScript", async (datei: string) => {
    const quelle = readFileSync(join(ORDNER, datei), "utf8");
    await expect(transform(quelle, { loader: "ts", sourcefile: datei })).resolves.toBeTruthy();
  });
});
