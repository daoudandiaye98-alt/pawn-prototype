/**
 * `istHeftAdresse` muss dieselben Adressen kennen wie `App.tsx`.
 *
 * Die Einwilligungsleiste hängt daran: sie steht im Heft nur auf dem Umschlag.
 * Käme eine Sektion dazu, ohne dass diese Liste sie kennt, stünde die Leiste
 * plötzlich mitten im Heft — ein Fehler, den niemand suchen würde.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { istHeftAdresse } from "@/heft/doppelseiten";

/** Alle `path=`-Werte, deren Route auf `HeftRoute` zeigt. */
function heftRoutenAusApp(): string[] {
  const t = readFileSync(resolve(__dirname, "..", "App.tsx"), "utf8");
  /* Am `<Route ` zerteilen und je Stück fragen, ob HeftRoute darin steht — die
     Elemente enthalten selbst geschweifte Klammern (`fallback={null}`), an denen
     sich ein Muster über die ganze Zeile verschluckt. */
  return t.split("<Route ").slice(1)
    .filter((stueck) => stueck.slice(0, stueck.indexOf("/>")).includes("HeftRoute"))
    .map((stueck) => stueck.match(/^path="([^"]+)"/)?.[1] ?? "")
    .filter(Boolean);
}

describe("Heft-Adressen", () => {
  it("kennt jede Route, die App.tsx dem Heft gibt", () => {
    const routen = heftRoutenAusApp();
    expect(routen.length).toBeGreaterThan(10);
    for (const r of routen) {
      /* Aus dem Muster eine echte Adresse machen: `:slug` wird zu einem Wert. */
      const beispiel = r.replace(/:[a-zA-Z]+/g, "beispiel");
      expect(istHeftAdresse(beispiel), `${r} gilt nicht als Heft-Adresse`).toBe(true);
    }
  });

  it("hält fremde Adressen heraus", () => {
    for (const p of ["/studio", "/admin/archiv", "/kasse", "/impressum", "/apply"]) {
      expect(istHeftAdresse(p), `${p} sollte keine Heft-Adresse sein`).toBe(false);
    }
  });
});
