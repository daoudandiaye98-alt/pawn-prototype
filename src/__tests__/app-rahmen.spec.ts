/**
 * Zwei Welten in App.tsx, und keine Seite darf in der falschen stehen.
 *
 * Das Heft laedt weder das Woerterbuch noch den Rahmen (src/AppRahmen.tsx: Toasts,
 * Admin-Copilot, Einwilligungsleiste, Studio-Schriften) — sonst traegt jede Heft-Seite
 * wieder rund 440 kB, die sie nie zeichnet, und faellt durch das Seitengewicht des
 * Pruefstands (Kontrolle 4.7). Jede andere Seite haengt dagegen am Rahmen, denn erst der
 * laedt das Woerterbuch (`ladeWoerterbuch`). Eine Seite ausserhalb zeichnete t() ohne
 * Buch — und t() faellt auf den Schluessel zurueck: dann stuende woertlich
 * „auth.checkEmail" auf dem Bildschirm, ohne Fehler, ohne Warnung.
 *
 * Die Regel, die dieser Test haelt: ausserhalb von `<Route element={<AppRahmen />}>`
 * stehen nur das Heft, Umzuege (`<Navigate>`, WerkUmzug, HausUmzug); innerhalb nie das Heft.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const OHNE_RAHMEN = /^element=\{<(Heft|Navigate|WerkUmzug|HausUmzug)[\s/>]/;

/** Jede `<Route path=…>`-Zeile mit der Angabe, ob sie unter einem Rahmen steht. */
function routen(): { path: string; element: string; imRahmen: boolean }[] {
  const t = readFileSync(resolve(__dirname, "..", "App.tsx"), "utf8");
  const routes = t.slice(t.indexOf("<Routes>"), t.indexOf("</Routes>"));
  const aus: { path: string; element: string; imRahmen: boolean }[] = [];
  let tiefe = 0;
  for (const zeile of routes.split("\n").map((z) => z.trim())) {
    if (/^<Route\s+element=\{<AppRahmen\s*\/>\}>$/.test(zeile)) { tiefe++; continue; }
    if (zeile === "</Route>") { tiefe--; continue; }
    const m = zeile.match(/^<Route\s+path="([^"]+)"\s+(element=.*)$/);
    if (m) aus.push({ path: m[1], element: m[2], imRahmen: tiefe > 0 });
  }
  return aus;
}

describe("App.tsx: Heft ohne Rahmen, alles andere mit", () => {
  it("findet die Routen und genau zwei geschlossene Rahmen-Gruppen", () => {
    const t = readFileSync(resolve(__dirname, "..", "App.tsx"), "utf8");
    expect(routen().length).toBeGreaterThan(100);
    expect(t.match(/<Route\s+element=\{<AppRahmen\s*\/>\}>/g)?.length).toBe(2);
    expect(routen().filter((r) => r.imRahmen).length).toBeGreaterThan(50);
  });

  it("ausserhalb des Rahmens stehen nur das Heft und Umzuege", () => {
    const falsch = routen().filter((r) => !r.imRahmen && !OHNE_RAHMEN.test(r.element));
    expect(falsch.map((r) => r.path)).toEqual([]);
  });

  it("das Heft steht nie unter dem Rahmen", () => {
    const falsch = routen().filter((r) => r.imRahmen && /^element=\{<Heft\s*\/>\}/.test(r.element));
    expect(falsch.map((r) => r.path)).toEqual([]);
  });

  it("im Heft ruft nur HeftRoute03 t(), und erst nach dem Woerterbuch", () => {
    const ordner = resolve(__dirname, "..", "heft03");
    const mitI18n = readdirSync(ordner)
      .filter((d) => /\.(tsx?|mjs|js)$/.test(d))
      .filter((d) => /@\/lib\/i18n/.test(readFileSync(resolve(ordner, d), "utf8")));
    expect(mitI18n).toEqual(["HeftRoute03.tsx"]);
    // Ohne Kommentare: ein auskommentiertes `await` wartet auf nichts.
    const huelle = readFileSync(resolve(ordner, "HeftRoute03.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const erstesT = huelle.search(/\bt\(\s*"/);
    const warten = huelle.indexOf("await ladeWoerterbuch()");
    expect(warten).toBeGreaterThan(-1);
    expect(erstesT).toBeGreaterThan(warten);
  });
});
