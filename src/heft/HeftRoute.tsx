/**
 * Teil X2 — die Route.
 *
 * Eine Komponente für alle Heft-Adressen. Sie baut die Doppelseiten, gibt sie an
 * die Hülle und setzt den Seitentitel — sonst nichts. Wer eine Adresse
 * hinzufügt, tut das in `spreads/index.tsx` und in `App.tsx`, nicht hier.
 *
 * Der Titel ist Pflicht (Kontrolle 5.1) und kommt aus der Doppelseite, auf der
 * geöffnet wird. Er ändert sich beim Blättern mit — deshalb liest er `pathname`
 * und nicht einen festgehaltenen Startwert.
 */
import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Heft } from "./Heft";
import { Seo } from "@/components/palace/Seo";
import { heftSeiten } from "./spreads";
import { nummerFuerPfad } from "./doppelseiten";

const AUSGABE = "Ausgabe 001";

export default function HeftRoute() {
  const { pathname } = useLocation();
  const seiten = useMemo(() => heftSeiten(), []);
  const hier = seiten[nummerFuerPfad(seiten, pathname) - 1];

  return (
    <>
      <Seo
        title={`${hier?.kolumne ?? AUSGABE} — PAWN`}
        description="PAWN als Magazin: Mode, Interior und Kunst aus unabhängigen Häusern. Eine Hülle, eine Route, jede Sektion eine Doppelseite."
        /* Solange die Sektionen leer sind, gehört das Heft nicht in den Index
           (Kontrolle 2.7 — kein Entwurfsinhalt in der Suche). Mit Schritt 3
           fällt diese Zeile weg. */
        noindex
      />
      <Heft seiten={seiten} titel={`PAWN · ${AUSGABE}`} />
    </>
  );
}
