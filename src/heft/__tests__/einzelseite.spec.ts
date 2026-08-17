/**
 * Teil X3 — der Wendel im Einzelseiten-Modus, gerechnet statt behauptet.
 *
 * Die Korrektur, die hier abgesichert ist: auf dem Telefon wendet das Blatt um
 * EINE Seite, nicht um eine Doppelseite. Vorher zeigte das Heft dort nur rechte
 * Seiten, und jeder Wendel übersprang die linke — im Verzeichnis also sechs
 * Stücke pro Zug.
 *
 * **Warum ein Test und keine Messung.** Das hier ist reine Arithmetik: aus einer
 * Liste von Doppelseiten wird ein Stapel, und aus einem Scrollstand eine Adresse.
 * Dafür braucht es keinen Browser, und was ohne Browser prüfbar ist, soll ohne
 * Browser geprüft werden — der Prüfstand misst, was man nur sehen kann.
 */
import { describe, expect, it } from "vitest";
import { blaetterAus, einzelseitenAus, type Doppelseite } from "../doppelseiten";
import { doppelseiteFuerSeite, ersteSeiteVon, seitenNummer, standFuerSeite, WEG } from "../wendel";

/** Eine Doppelseite, reduziert auf das, was die Ableitung liest. */
const seite = (schluessel: string, ton: Doppelseite["ton"] = "papier"): Doppelseite => ({
  schluessel,
  pfad: `/${schluessel}`,
  kolumne: schluessel,
  titel: schluessel,
  sektion: schluessel,
  ton,
  links: `${schluessel}-links`,
  rechts: `${schluessel}-rechts`,
});

const heft = [seite("a"), seite("b", "nacht"), seite("c")];

describe("Einzelseite: der Stapel", () => {
  it("macht aus N Doppelseiten 2N Seiten und 2N-1 Wendel", () => {
    const auf = einzelseitenAus(heft);
    // 3 Doppelseiten = 6 Seiten = 5 Blätter + 1 Grund.
    expect(auf.schritte).toBe(5);
    expect(auf.grundRechts).toBe("c-rechts");
  });

  it("legt die Seiten in Leserichtung: links, rechts, links, rechts …", () => {
    const auf = einzelseitenAus(heft);
    expect(auf.blaetter.map((b) => b.vorn)).toEqual([
      "a-links", "a-rechts", "b-links", "b-rechts", "c-links",
    ]);
  });

  it("gibt jedem Blatt genau eine Seite — die Rückseite bleibt leer", () => {
    for (const b of einzelseitenAus(heft).blaetter) {
      expect(b.rueck).toBeNull();
      expect(b.tonRueck).toBeNull();
    }
  });

  it("nimmt den Ton von der Doppelseite mit, zu der die Seite gehört", () => {
    const auf = einzelseitenAus(heft);
    // Doppelseite b ist „nacht" — beide ihre Seiten also auch.
    expect(auf.blaetter[2].tonVorn).toBe("nacht");
    expect(auf.blaetter[3].tonVorn).toBe("nacht");
    expect(auf.blaetter[1].tonVorn).toBe("papier");
  });

  it("lässt die Doppelseiten-Ableitung unberührt", () => {
    const auf = blaetterAus(heft);
    expect(auf.schritte).toBe(2);
    expect(auf.grundLinks).toBe("a-links");
    expect(auf.grundRechts).toBe("c-rechts");
    expect(auf.blaetter[0].vorn).toBe("a-rechts");
    expect(auf.blaetter[0].rueck).toBe("b-links");
  });
});

describe("Einzelseite: Seite und Adresse", () => {
  it("gibt zwei aufeinanderfolgenden Seiten dieselbe Doppelseite", () => {
    expect(doppelseiteFuerSeite(1)).toBe(1);
    expect(doppelseiteFuerSeite(2)).toBe(1);
    expect(doppelseiteFuerSeite(13)).toBe(7);
    expect(doppelseiteFuerSeite(14)).toBe(7);
    expect(doppelseiteFuerSeite(15)).toBe(8);
  });

  it("schlägt eine Adresse auf ihrer ersten Seite auf — links", () => {
    expect(ersteSeiteVon(1)).toBe(1);
    expect(ersteSeiteVon(7)).toBe(13);
    expect(ersteSeiteVon(8)).toBe(15);
  });

  it("bleibt umkehrbar: erste Seite → dieselbe Doppelseite", () => {
    for (let n = 1; n <= 40; n++) {
      expect(doppelseiteFuerSeite(ersteSeiteVon(n))).toBe(n);
    }
  });

  /*
   * Der Fall aus dem Auftrag, Schritt für Schritt.
   *
   * „/verzeichnis/7 öffnet links, einmal wenden zeigt rechts (Adresse gleich),
   *  nochmal wenden ist /verzeichnis/8."
   */
  it("führt die Adresse erst bei jedem zweiten Wendel fort", () => {
    const blaetter = 40;
    const adresse = (y: number) => doppelseiteFuerSeite(seitenNummer(y, blaetter));

    let y = standFuerSeite(ersteSeiteVon(7)); // aufgeschlagen: /verzeichnis/7, links
    expect(adresse(y)).toBe(7);

    y += WEG;                                 // einmal wenden: rechts
    expect(adresse(y)).toBe(7);

    y += WEG;                                 // nochmal wenden: /verzeichnis/8
    expect(adresse(y)).toBe(8);

    y += WEG;                                 // und weiter: rechts von 8
    expect(adresse(y)).toBe(8);
  });

  it("überspringt im Doppelseiten-Modus dagegen nichts: ein Wendel, eine Adresse", () => {
    const blaetter = 20;
    let y = standFuerSeite(7);
    expect(seitenNummer(y, blaetter)).toBe(7);
    y += WEG;
    expect(seitenNummer(y, blaetter)).toBe(8);
  });
});
