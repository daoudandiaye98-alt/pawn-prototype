/**
 * Die Wache über `vercel.json`.
 *
 * Diese Datei entscheidet auf einer Seite mit echten Stripe-Zahlungen, welche
 * Adresse ausgeliefert wird und welche 404 bekommt. Ein falscher Ausdruck darin
 * nimmt eine echte Seite vom Netz — leise, denn der Build bleibt grün. Deshalb
 * wird sie geprüft wie Code und nicht wie Konfiguration.
 *
 * Drei Zusagen:
 *
 *   1. Das Eingecheckte ist der Stand von `routen.js`. Wer eine Adresse
 *      hinzufügt und `node tools/vercel-routen.mjs` vergisst, fällt hier auf.
 *   2. JEDE bekannte Adresse trifft eine 200-Regel, bevor der Auffang greift.
 *      Das ist die Zusage, die die Seite am Leben hält.
 *   3. Erfundene Adressen treffen NUR den Auffang. Das ist die Zusage, für die
 *      der Umbau gemacht wurde.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROUTEN, UMZUEGE, istBekannteRoute } from "../../routen.js";
import { baueVercelJson } from "../../tools/vercel-routen.mjs";

const erzeugt = baueVercelJson();
/* Über das Arbeitsverzeichnis, nicht über `import.meta.url`: im Testlauf ist
   das keine `file:`-Adresse, und `readFileSync` nimmt sie dann nicht an. */
const eingecheckt = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"));

/** Die erste Regel, die greift — so, wie Vercel die Liste von oben abarbeitet. */
function ersteRegel(pfad: string) {
  return erzeugt.routes.find((r: { src?: string }) => r.src && new RegExp(r.src).test(pfad));
}

describe("vercel.json", () => {
  it("ist der Stand von routen.js", () => {
    expect(eingecheckt).toEqual(erzeugt);
  });

  it("trägt nur Schlüssel, die das Schema kennt", () => {
    // Ein unbekannter Schlüssel macht die Datei ungültig und die Auslieferung tot.
    expect(Object.keys(eingecheckt)).toEqual(["routes"]);
  });

  it("liefert echte Dateien vor allem anderen", () => {
    expect(erzeugt.routes[0]).toEqual({ handle: "filesystem" });
  });

  /* X1: eine Adresse, die umzieht, trifft zuerst ihre 301 — alle übrigen die 200. */
  const zieht = (route: string) => UMZUEGE.some((u: { von: string }) => u.von === route);

  it.each(ROUTEN.filter((r) => !zieht(r)).map((r) => [r]))("%s bekommt 200, nicht den Auffang", (route: string) => {
    // `:name` durch einen echten Abschnitt ersetzen — so kommt die Adresse an.
    const pfad = route.replace(/:[^/]+/g, "beispiel");
    const regel = ersteRegel(pfad);
    expect(regel, `keine Regel trifft ${pfad}`).toBeDefined();
    expect(regel!.status, `${pfad} fiele in den 404-Auffang`).toBeUndefined();
  });

  it.each(UMZUEGE.map((u: { von: string; nach: string }) => [u.von, u.nach]))(
    "%s zieht mit 301 nach %s um", (von: string, nach: string) => {
      /* „mode" als Beispielabschnitt, nicht ein Fantasiewort: beim
         Sektions-Umzug ist das Ziel wörtlich (`/mode`), und nur ein echter
         Sektionsname landet auf einer bekannten Adresse. `/heft/erfunden`
         → `/erfunden` → 404 ist gewollt — ein Umzug adelt keine erfundene
         Adresse. */
      const pfad = von.replace(/:[^/]+/g, "mode");
      const regel = ersteRegel(pfad);
      expect(regel?.status, `${pfad} bekäme keinen 301`).toBe(301);
      const ziel = (regel!.headers as Record<string, string>).Location
        .replace(/\$\d+/g, "mode");
      expect(ziel).toBe(nach.replace(/:[^/]+/g, "mode"));
      // Ein Umzug in eine tote Adresse wäre eine 301 in die 404.
      expect(istBekannteRoute(ziel), `${ziel} ist keine bekannte Adresse`).toBe(true);
    });

  it("der Umschlag-Umzug greift vor der Sektions-Musterzeile", () => {
    const regel = ersteRegel("/heft/umschlag");
    expect((regel!.headers as Record<string, string>).Location).toBe("/");
  });

  it.each([
    ["/diese-seite-gibt-es-nicht-4d9f21"],
    ["/mode/gibtesnicht"],
    ["/werk/eins/zwei"],
    ["/studio/gibtesnicht"],
  ])("%s bekommt 404", (pfad: string) => {
    const regel = ersteRegel(pfad);
    expect(regel?.status, `${pfad} bekäme 200`).toBe(404);
  });

  it("die 404 trägt ihre Spur und bleibt aus dem Zwischenspeicher", () => {
    const auffang = erzeugt.routes[erzeugt.routes.length - 1];
    expect(auffang.status).toBe(404);
    expect(auffang.dest).toBe("/index.html");
    expect(auffang.headers["cache-control"]).toBe("no-store");
    expect(auffang.headers["x-pawn-404"]).toBe("vercel-json");
  });
});
