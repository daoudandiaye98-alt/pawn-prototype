/**
 * Zwei Listen, eine Wahrheit.
 *
 * Die Routen stehen zweimal: als JSX in `src/App.tsx`, weil React Router sie so
 * braucht, und als Zeichenketten in `routen.ts`, weil die Middleware am Rand
 * läuft und kein React kennt. Doppelt gehaltene Wahrheit läuft auseinander —
 * hier nicht.
 *
 * **Was passiert, wenn es doch auseinanderläuft.** Wer eine Route in `App.tsx`
 * hinzufügt und `routen.ts` vergisst, baut eine Seite, die es gibt, die der
 * Server aber mit 404 beantwortet: unsichtbar für Suchmaschinen, und in der
 * Konsole des Browsers ein Fehler. Wer umgekehrt eine Route entfernt und die
 * Liste stehen lässt, hat die 404 wieder verloren, für die K7 gebaut wurde.
 * Beides ist von außen schwer zu sehen und hier in einer Sekunde gemessen.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { ROUTEN, istBekannteRoute, istPlattformOderDatei } from "../../routen";

/** Die Pfade so, wie sie in der Routentabelle stehen — ohne den Auffang `*`. */
function pfadeAusApp(): string[] {
  const quelle = readFileSync(resolve(__dirname, "../App.tsx"), "utf8");
  return [...quelle.matchAll(/<Route\s+path="([^"]+)"/g)]
    .map((t) => t[1])
    .filter((p) => p !== "*");
}

describe("Die Routenliste der Middleware und die des Browsers", () => {
  it("enthalten dieselben Adressen", () => {
    expect([...ROUTEN].sort()).toEqual(pfadeAusApp().sort());
  });

  it("halten die Reihenfolge — sonst ist die Liste nicht mehr abgeschrieben, sondern gepflegt", () => {
    expect([...ROUTEN]).toEqual(pfadeAusApp());
  });

  it("führt jede Route doppelfrei", () => {
    expect(new Set(ROUTEN).size).toBe(ROUTEN.length);
  });
});

describe("Welche Adresse die Middleware durchlässt", () => {
  it("erkennt feste Adressen", () => {
    expect(istBekannteRoute("/")).toBe(true);
    expect(istBekannteRoute("/shop")).toBe(true);
    expect(istBekannteRoute("/preise/maison")).toBe(true);
    expect(istBekannteRoute("/studio/werke/neu")).toBe(true);
  });

  it("erkennt Adressen mit Platzhalter", () => {
    expect(istBekannteRoute("/werk/leinenmantel")).toBe(true);
    expect(istBekannteRoute("/product/leinenmantel")).toBe(true);
    expect(istBekannteRoute("/designer/haus-eins")).toBe(true);
    expect(istBekannteRoute("/verzeichnis/3")).toBe(true);
  });

  it("nimmt einen Platzhalter nicht für mehrere Abschnitte", () => {
    /* `/werk/:slug` ist EIN Abschnitt. Zwei sind eine andere Adresse. */
    expect(istBekannteRoute("/werk/haus/leinenmantel")).toBe(false);
  });

  it("erkennt erfundene Adressen", () => {
    expect(istBekannteRoute("/diese-seite-gibt-es-nicht-4d9f21")).toBe(false);
    expect(istBekannteRoute("/shop/gibtesnicht")).toBe(false);
    expect(istBekannteRoute("/studio/gibtesnicht")).toBe(false);
    /* Die Sonde ist ersetzt — ihre Adresse ist jetzt eine erfundene wie jede andere. */
    expect(istBekannteRoute("/__sonde-middleware")).toBe(false);
  });

  it("lässt Dateien und Plattform-Adressen unangetastet", () => {
    /* Diese Prüfung ist der Grund, warum das Nachladen der Hülle keine
       Schleife baut: `/index.html` trägt einen Punkt. */
    expect(istPlattformOderDatei("/index.html")).toBe(true);
    expect(istPlattformOderDatei("/favicon.ico")).toBe(true);
    expect(istPlattformOderDatei("/robots.txt")).toBe(true);
    expect(istPlattformOderDatei("/assets/index-abc123.js")).toBe(true);
    expect(istPlattformOderDatei("/api/irgendwas")).toBe(true);
    expect(istPlattformOderDatei("/_vercel/insights/script.js")).toBe(true);
  });

  it("hält eine echte Adresse nicht für eine Datei", () => {
    expect(istPlattformOderDatei("/shop")).toBe(false);
    expect(istPlattformOderDatei("/werk/leinenmantel")).toBe(false);
    expect(istPlattformOderDatei("/preise/maison")).toBe(false);
  });
});

/**
 * Die Wache für Kontrolle 4.3 — und der Grund, warum K7 nicht gefährlich ist.
 *
 * Solange jede Adresse mit 200 antwortete, war ein toter interner Link
 * unsichtbar: er führte auf „Seite nicht gefunden", und niemand merkte es. Mit
 * der echten 404 wird derselbe Link zu einem gefallenen Gate — richtig so, aber
 * erst dann sichtbar, wenn er schon ausgeliefert ist.
 *
 * Dieser Test zieht die Prüfung nach vorn. Gleich beim ersten Lauf hat er einen
 * echten Fund gemacht: die Datenschutzerklärung verlinkte seit Teil AP3 auf
 * `/wie-pawn-ki-nutzt`; die Seite gab es, die Route nicht.
 */
function dateienUnter(verzeichnis: string, gesammelt: string[] = []): string[] {
  for (const eintrag of readdirSync(verzeichnis)) {
    const pfad = join(verzeichnis, eintrag);
    if (statSync(pfad).isDirectory()) dateienUnter(pfad, gesammelt);
    else if (/\.tsx?$/.test(eintrag)) gesammelt.push(pfad);
  }
  return gesammelt;
}

describe("Interne Links", () => {
  it("zeigen alle auf Adressen, die es gibt", () => {
    const wurzel = resolve(__dirname, "..");
    const tot = new Set<string>();
    for (const datei of dateienUnter(wurzel)) {
      const quelle = readFileSync(datei, "utf8");
      /* Nur feste Zeichenketten. Zusammengesetzte Adressen (`{`, `$`) sind zur
         Bauzeit nicht bekannt und werden hier ehrlich ausgelassen, statt
         geraten. */
      for (const treffer of quelle.matchAll(/(?:to|href)="(\/[^"{}$]*)"/g)) {
        const pfad = treffer[1].split("?")[0].split("#")[0];
        if (!pfad || pfad === "/") continue;
        if (istPlattformOderDatei(pfad)) continue;
        if (!istBekannteRoute(pfad)) tot.add(`${pfad} in ${datei.replace(wurzel, "src")}`);
      }
    }
    expect([...tot]).toEqual([]);
  });
});
