/**
 * Drei Listen, eine Wahrheit.
 *
 * Die Adressen des Hefts stehen an drei Stellen, und das ist kein Versehen:
 *
 *   · `src/heft03/routen.mjs` — das Heft selbst. Es übersetzt Route ↔ Pfad und hängt an
 *     seinen Daten (`data.mjs`), weil eine Welt so viele Doppelseiten hat, wie es Häuser
 *     gibt.
 *   · `src/App.tsx` — React Router braucht sie als JSX.
 *   · `routen.js` — die Middleware und `vercel.json` laufen am Rand, ohne React und ohne
 *     das Heft. Aus dieser Liste entsteht der Statuscode jeder Adresse.
 *
 * Laufen sie auseinander, merkt das niemand von außen: Die Seite tut es weiter, aber der
 * Server beantwortet eine echte Adresse mit 404 oder eine erfundene mit 200 — beides
 * sieht ein Mensch erst in der Search Console, Wochen später.
 *
 * Dieselbe Frage gilt für die Umzüge: eine 301 gehört serverseitig UND als `<Navigate>`
 * in die App, sonst zieht ein Klick innerhalb der Seite nicht um.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROUTEN, UMZUEGE, ZAEHLENDE_PLATZHALTER, istBekannteRoute } from "../../routen.js";
import { alleAdressen, UMZUEGE as UMZUEGE_HEFT } from "@/heft03/routen.mjs";
import { istHeftAdresse } from "@/heft03/adressen";

/** Alle `path=`-Werte, deren Route auf das Heft zeigt. */
function heftRoutenAusApp(): string[] {
  const t = readFileSync(resolve(__dirname, "..", "App.tsx"), "utf8");
  /* Je Zeile eine Route. Nicht bis zum ersten `/>` schneiden — das steht schon im
     `<Heft />` selbst. */
  return t
    .split("<Route ")
    .slice(1)
    .map((stueck) => stueck.split("\n")[0])
    .filter((zeile) => /element=\{<Heft\s*\/>\}/.test(zeile))
    .map((zeile) => zeile.match(/^path="([^"]+)"/)?.[1] ?? "")
    .filter(Boolean);
}

/** Aus einem Muster eine echte Adresse machen; zählende Abschnitte bekommen eine Zahl. */
function alsAdresse(muster: string): string {
  return muster.replace(/:([^/]+)/g, (_, name: string) =>
    ZAEHLENDE_PLATZHALTER.includes(name) ? "2" : "beispiel",
  );
}

/** Passt eine echte Adresse auf eines der Muster, die App.tsx dem Heft gibt? */
function trifftHeftRoute(pfad: string, muster: string[]): boolean {
  const teile = pfad.split("?")[0].split("/").filter(Boolean);
  return muster.some((m) => {
    const mt = m.split("/").filter(Boolean);
    if (mt.length !== teile.length) return false;
    return mt.every((x, i) =>
      x.startsWith(":")
        ? ZAEHLENDE_PLATZHALTER.includes(x.slice(1))
          ? /^[0-9]+$/.test(teile[i])
          : teile[i].length > 0
        : x === teile[i],
    );
  });
}

describe("Die Adressen des Hefts", () => {
  const heftRouten = heftRoutenAusApp();

  it("stehen in App.tsx — mehr als zwei Dutzend Doppelseiten", () => {
    expect(heftRouten.length).toBeGreaterThan(25);
  });

  it.each(alleAdressen().map((a: string) => [a]))(
    "%s trifft eine Heft-Route in App.tsx",
    (adresse: string) => {
      expect(trifftHeftRoute(adresse, heftRouten), `${adresse} zeigt auf keine Heft-Route`).toBe(true);
    },
  );

  it.each(alleAdressen().map((a: string) => [a]))("%s ist dem Server bekannt", (adresse: string) => {
    expect(istBekannteRoute(adresse.split("?")[0]), `${adresse} bekäme eine 404`).toBe(true);
  });

  it("hält jede Heft-Route auch in routen.js", () => {
    const fehlt = heftRouten.filter((r) => !ROUTEN.includes(r));
    expect(fehlt, `nicht in routen.js: ${fehlt.join(", ")}`).toEqual([]);
  });

  it("gibt einer erfundenen Seitenzahl keine 200 — dafür nehmen zählende Abschnitte nur Ziffern", () => {
    for (const pfad of ["/mode/gibtesnicht", "/haus/lind/erstes", "/haeuser/x", "/konto/letzte"]) {
      expect(istBekannteRoute(pfad), `${pfad} gilt als echte Adresse`).toBe(false);
    }
    for (const pfad of ["/mode/2", "/haus/lind/3", "/haeuser/4", "/konto/3"]) {
      expect(istBekannteRoute(pfad), `${pfad} gilt nicht als echte Adresse`).toBe(true);
    }
  });
});

describe("Die Umzüge", () => {
  it("stehen im Heft und in routen.js mit demselben Ziel", () => {
    for (const [von, nach] of Object.entries(UMZUEGE_HEFT as Record<string, string>)) {
      const server = UMZUEGE.find((u: { von: string }) => u.von === von);
      expect(server, `${von} zieht im Heft um, serverseitig nicht`).toBeDefined();
      expect(server!.nach, `${von} zieht im Heft nach ${nach}, serverseitig nach ${server!.nach}`).toBe(nach);
    }
  });

  it("stehen auch als Navigate in App.tsx — sonst zieht ein Klick in der Seite nicht um", () => {
    const app = readFileSync(resolve(__dirname, "..", "App.tsx"), "utf8");
    for (const u of UMZUEGE) {
      /* Zwei Umzüge tragen einen Abschnitt mit und haben darum einen eigenen Helfer. */
      const eigen = u.von.includes(":");
      const zeile = eigen
        ? new RegExp(`path="${u.von.replace(/[/:]/g, (c) => "\\" + c)}"\\s+element=\\{<\\w+Umzug`)
        : new RegExp(`path="${u.von}"\\s+element=\\{<Navigate to="${u.nach}"`);
      expect(zeile.test(app), `${u.von} zieht serverseitig um, in App.tsx nicht`).toBe(true);
    }
  });

  it("führen nie in eine tote Adresse", () => {
    for (const u of UMZUEGE) {
      expect(istBekannteRoute(alsAdresse(u.nach)), `${u.von} zieht nach ${u.nach} — die gibt es nicht`).toBe(true);
    }
  });
});

describe("istHeftAdresse", () => {
  /* Daran hängt, wo die Einwilligungsleiste steht: im Heft fragt PAWN selbst. */
  it.each(heftRoutenAusApp().map((r) => [r]))("kennt %s", (route: string) => {
    expect(istHeftAdresse(alsAdresse(route)), `${route} gilt nicht als Heft-Adresse`).toBe(true);
  });

  it("hält fremde Adressen heraus", () => {
    for (const p of ["/studio", "/admin/archiv", "/impressum", "/apply/form", "/auth", "/order/success", "/preise"]) {
      expect(istHeftAdresse(p), `${p} sollte keine Heft-Adresse sein`).toBe(false);
    }
  });
});
