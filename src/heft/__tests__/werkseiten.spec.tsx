/**
 * Teil X7 — die Werke stehen als Doppelseiten im Heft, gerechnet statt behauptet.
 *
 * Geprüft wird die Ordnung, nicht das Aussehen: welche Doppelseite es gibt,
 * welche Adresse sie trägt und in welcher Reihenfolge sie liegen. Genau daraus
 * folgt X7s Satz „voriges und nächstes Werk sind ein Wendel" — wenn die Werke
 * lückenlos hintereinander liegen, ist der Wendel der Weg und braucht keine
 * Knöpfe.
 */
import { describe, expect, it } from "vitest";
import { heftSeiten } from "../spreads";
import { findeNummer } from "../doppelseiten";
import { LEERES_VERZEICHNIS, werkPfad, type VerzeichnisStand, type Werk } from "../verzeichnis";

const werk = (slug: string, name: string): Werk => ({
  id: `id-${slug}`,
  slug,
  name,
  preis: 200,
  welt: "Mode",
  bild: `https://example.invalid/${slug}.jpg`,
  haus: { id: "h1", slug: "haus-eins", name: "Haus Eins", kannVerkaufen: true },
  beschreibung: null,
  dna: null,
  groessen: [],
  anfragenErlaubt: false,
});

const stand = (alle: Werk[], sichtbar = alle): VerzeichnisStand => ({
  ...LEERES_VERZEICHNIS,
  werke: sichtbar,
  alle,
  laedt: false,
});

const bauen = (verzeichnis: VerzeichnisStand) =>
  heftSeiten({ aufSprung: () => {}, verzeichnis });

describe("X7 — die Werke im Heft", () => {
  it("gibt jedem Werk eine eigene Adresse", () => {
    const seiten = bauen(stand([werk("mantel", "Leinenmantel"), werk("schale", "Schale")]));
    expect(findeNummer(seiten, werkPfad("mantel"))).not.toBeNull();
    expect(findeNummer(seiten, werkPfad("schale"))).not.toBeNull();
  });

  it("legt die Werke lückenlos hintereinander — ein Wendel je Werk", () => {
    const seiten = bauen(stand([werk("a", "A"), werk("b", "B"), werk("c", "C")]));
    const a = findeNummer(seiten, werkPfad("a"))!;
    expect(findeNummer(seiten, werkPfad("b"))).toBe(a + 1);
    expect(findeNummer(seiten, werkPfad("c"))).toBe(a + 2);
  });

  it("trägt den Namen des Werks als Titel — die eine h1 der Adresse", () => {
    const seiten = bauen(stand([werk("mantel", "Leinenmantel")]));
    const n = findeNummer(seiten, werkPfad("mantel"))!;
    expect(seiten[n - 1].titel).toBe("Leinenmantel");
  });

  it("liegt hinter dem Verzeichnis, nicht davor", () => {
    const seiten = bauen(stand([werk("mantel", "Leinenmantel")]));
    const verzeichnis = findeNummer(seiten, "/verzeichnis/1")!;
    expect(findeNummer(seiten, werkPfad("mantel"))!).toBeGreaterThan(verzeichnis);
  });

  it("behält seine Adresse, auch wenn ein Filter es aus dem Verzeichnis nimmt", () => {
    /* Der Kern der Entscheidung „aus dem UNgefilterten Bestand": ein
       weitergegebener Link darf nicht daran scheitern, dass der Empfänger einen
       Reiter in seiner Adresse stehen hat. */
    const alle = [werk("mantel", "Leinenmantel"), werk("schale", "Schale")];
    const seiten = bauen(stand(alle, [alle[0]]));
    expect(findeNummer(seiten, werkPfad("schale"))).not.toBeNull();
  });

  it("ohne Bestand gibt es keine Werkseiten — und trotzdem ein Heft", () => {
    const seiten = bauen(stand([]));
    expect(seiten.some((s) => s.pfad.startsWith("/werk/"))).toBe(false);
    expect(findeNummer(seiten, "/verzeichnis/1")).not.toBeNull();
  });
});
