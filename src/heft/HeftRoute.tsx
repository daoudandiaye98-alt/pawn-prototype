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
 */
import { useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Heft } from "./Heft";
import { Seo } from "@/components/palace/Seo";
import { FRAG_PAWN_PFAD, heftSeiten } from "./spreads";
import { nummerFuerPfad, type Doppelseite } from "./doppelseiten";

const AUSGABE = "Ausgabe 001";

export default function HeftRoute() {
  const { pathname } = useLocation();

  /*
   * Muss stabil bleiben: die Hülle baut daraus ihren gesamten Inhalt und würde
   * ihn bei jedem Blättern neu bauen, wenn hier jedes Mal eine neue Funktion
   * stünde.
   */
  const bauen = useCallback(
    (aufSprung: (n: number) => void): Doppelseite[] => heftSeiten({ aufSprung }),
    [],
  );

  /*
   * Nur für den Titel. Die Doppelseiten selbst baut die Hülle — hier entsteht
   * eine zweite, inhaltsgleiche Liste, aus der ausschließlich Titel und
   * Kolumnentitel gelesen werden. Das ist billig (Beschreibungen, keine
   * gezeichneten Seiten) und spart einen Rückkanal aus der Hülle heraus.
   */
  const hier = useMemo(() => {
    const seiten = heftSeiten({ aufSprung: () => {} });
    return seiten[nummerFuerPfad(seiten, pathname) - 1];
  }, [pathname]);

  return (
    <>
      <Seo
        title={`${hier?.kolumne ?? AUSGABE} — PAWN`}
        description="PAWN als Magazin: Mode, Interior und Kunst aus unabhängigen Häusern. Eine Hülle, eine Route, jede Sektion eine Doppelseite."
        /*
         * Noch nicht in den Index.
         *
         * Nicht, weil die Sektionen leer wären — sie tragen jetzt ihren Text und
         * ihre Platten. Sondern weil das Heft auf `/heft/…` liegt, während `/`,
         * `/mode`, `/interior` und `/kunst` dieselben Inhalte noch als alte
         * Seiten führen. Zwei indexierte Adressen für denselben Inhalt sind für
         * die Suche schlechter als eine. Mit X1 zieht das Heft auf die
         * endgültigen Adressen, die alten Seiten fallen weg, und diese Zeile
         * fällt mit ihnen.
         */
        noindex
      />
      <Heft bauen={bauen} titel={`PAWN · ${AUSGABE}`} suchePfad={FRAG_PAWN_PFAD} />
    </>
  );
}
