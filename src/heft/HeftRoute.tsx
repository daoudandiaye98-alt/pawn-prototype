/**
 * Teil X2 — die Route.
 *
 * Eine Komponente für alle Heft-Adressen. Sie gibt der Hülle den Bauplan der
 * Doppelseiten und setzt den Seitentitel — sonst nichts. Wer eine Adresse
 * hinzufügt, tut das in `spreads/index.tsx` und in `App.tsx`, nicht hier.
 *
 * Der Titel ist Pflicht (Kontrolle 5.1) und kommt aus der Doppelseite, auf der
 * gerade aufgeschlagen ist. Er ändert sich beim Blättern mit, weil die Hülle die
 * Adresse über den Router fortschreibt und `useLocation` das mitbekommt.
 *
 * **Was mit X6 hinzukommt.** Der Katalog braucht Daten, und Daten holt weder die
 * Hülle noch die Seitenliste — beide sollen rein bleiben. Also holt sie diese
 * Route: sie lädt die Stücke, liest die Filter aus der Adresse, baut daraus die
 * Reiter fürs Griffregister und reicht den Stand in die Seitenliste.
 */
import { useCallback, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Heft } from "./Heft";
import { Seo } from "@/components/palace/Seo";
import { FRAG_PAWN_PFAD, heftSeiten } from "./spreads";
import { nummerFuerPfad, type Doppelseite } from "./doppelseiten";
import type { FilterGruppe, FilterWahl } from "./register";
import {
  V, blattAusPfad, reiterAus, useVerzeichnisStand, useVerzeichnisWerke,
  type Filter,
} from "./verzeichnis";
import { useHausKapitel } from "./haeuser";

const AUSGABE = "Ausgabe 001";

export default function HeftRoute() {
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();

  /* ————— Das Verzeichnis (X6) ————— */

  const bestand = useVerzeichnisWerke();

  /* Die Häuser als Kapitel (X8) — geladen wie das Verzeichnis: hier, nicht in
     der Seitenliste. */
  const haeuser = useHausKapitel();

  /*
   * Die Filter stehen in der Adresse, nicht in einem Zustand.
   *
   * Ein gefiltertes Verzeichnis ist dann weitergebbar, überlebt das Neuladen und
   * den Zurück-Knopf — dieselbe Regel wie in der Boutique (`/shop?welt=Kunst`).
   * Ein Zustand im Kopf der Komponente könnte das alles nicht.
   */
  const filter: Filter = useMemo(() => ({
    welt: params.get("welt"),
    preis: params.get("preis"),
    haus: params.get("haus"),
  }), [params]);

  /*
   * Wie viele Katalogblätter es mindestens gibt — einmal beim Betreten gelesen.
   *
   * Siehe `VerzeichnisStand.mindestBlaetter`: `/verzeichnis/7` muss seine
   * Doppelseite schon im ersten Bild finden, bevor die Stücke da sind.
   */
  const [mindestBlaetter] = useState(() => blattAusPfad(pathname));

  const verzeichnis = useVerzeichnisStand(bestand, filter, mindestBlaetter);

  /**
   * Eine Wahl umlegen. Zweites Antippen nimmt sie zurück.
   *
   * `replace`, damit eine Reihe von Reiterklicks nicht als Reihe von Einträgen
   * im Verlauf liegt — der Zurück-Knopf soll aus dem Verzeichnis herausführen,
   * nicht durch fünf Filterzustände.
   */
  const waehle = useCallback((feld: keyof Filter, wert: string) => {
    const naechste = new URLSearchParams(params);
    if (naechste.get(feld) === wert) naechste.delete(feld);
    else naechste.set(feld, wert);
    setParams(naechste, { replace: true });
  }, [params, setParams]);

  /*
   * Die Reiter entstehen aus dem UNgefilterten Bestand.
   *
   * Sonst nähme eine gewählte Welt alle anderen Welten aus dem Register, und man
   * käme nur noch über den Zurück-Knopf heraus. Ein Register, das sich beim
   * Benutzen selbst auflöst, ist keines.
   */
  const filterGruppen: FilterGruppe[] | undefined = useMemo(() => {
    if (!pathname.startsWith(V)) return undefined;
    const { welten, preise, haeuser } = reiterAus(bestand.werke);
    const gruppe = (name: string, feld: keyof Filter, wahl: typeof welten): FilterGruppe => ({
      name,
      zu: `${V}/1`,
      wahl: wahl.map((w): FilterWahl => ({
        schluessel: w.schluessel,
        wort: w.wort,
        kurz: w.kurz,
        gewaehlt: filter[feld] === w.wert,
        waehle: () => waehle(feld, w.wert),
      })),
    });
    return [
      gruppe("Welt", "welt", welten),
      gruppe("Preis", "preis", preise),
      gruppe("Haus", "haus", haeuser),
    ];
  }, [pathname, bestand.werke, filter, waehle]);

  /* ————— Der Bauplan ————— */

  /*
   * Muss stabil bleiben, solange sich am Katalog nichts ändert: die Hülle baut
   * daraus ihren gesamten Inhalt und würde ihn sonst bei jedem Blättern neu
   * bauen. `verzeichnis` ist selbst gemerkt und wechselt nur, wenn Stücke oder
   * Filter wechseln — genau dann SOLL neu gebaut werden.
   */
  const bauen = useCallback(
    (aufSprung: (n: number) => void): Doppelseite[] => heftSeiten({ aufSprung, verzeichnis, haeuser }),
    [verzeichnis, haeuser],
  );

  /*
   * Nur für den Titel. Die Doppelseiten selbst baut die Hülle — hier entsteht
   * eine zweite, inhaltsgleiche Liste, aus der ausschließlich Titel und
   * Kolumnentitel gelesen werden. Das ist billig (Beschreibungen, keine
   * gezeichneten Seiten) und spart einen Rückkanal aus der Hülle heraus.
   */
  const hier = useMemo(() => {
    const seiten = heftSeiten({ aufSprung: () => {}, verzeichnis, haeuser });
    return seiten[nummerFuerPfad(seiten, pathname) - 1];
  }, [pathname, verzeichnis, haeuser]);

  return (
    <>
      <Seo
        title={`${hier?.kolumne ?? AUSGABE} — PAWN`}
        description="PAWN als Magazin: Mode, Interior und Kunst aus unabhängigen Häusern. Eine Hülle, eine Route, jede Sektion eine Doppelseite."
      />
      <Heft
        bauen={bauen}
        titel={`PAWN · ${AUSGABE}`}
        suchePfad={FRAG_PAWN_PFAD}
        filter={filterGruppen}
      />
    </>
  );
}
