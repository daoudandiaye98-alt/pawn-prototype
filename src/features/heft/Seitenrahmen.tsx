/**
 * Teil M2 — der Satzspiegel.
 *
 * Jede Seite trägt dieselben Marken; daran erkennt man ein Heft:
 *
 *   Kopfmarke      oben außen, linke Seite    P♟WN
 *   Sektionszeichen oben außen, rechte Seite  ✝
 *   Kolumnentitel  oben innen                 der Abschnitt
 *   Folio          unten außen                zweistellig, Tabellenziffern
 *   Weg            unten                      Pfeil und Unterlinie, genau einer
 *
 * ENTSCHEIDUNG: M2 setzt Kopfmarke **und** Sektionszeichen „oben außen". Beide
 * an dieselbe Stelle geht nicht, also trägt die linke Seite die Marke und die
 * rechte das Zeichen — der klassische Wechsel von Verso und Rekto. So steht
 * oben außen immer genau ein Zeichen, und die Doppelseite hat beide.
 *
 * Der Farbrhythmus (`ton`) kippt zwischen Papier und Nacht. Er ist eine
 * Eigenschaft der Seite, nicht des Inhalts — deshalb hängt er hier.
 */
import { Link } from "react-router-dom";
import { PawnWordmark } from "@/components/pawn/PawnWordmark";

export type Ton = "papier" | "nacht";
export type Aussen = "links" | "rechts";

export interface WegAngabe {
  text: string;
  zu: string;
}

export function Heftseite({
  ton = "papier", aussen, kolumne, folio, weg, children, className,
}: {
  ton?: Ton;
  aussen: Aussen;
  /** Der Abschnitt, oben innen. */
  kolumne: string;
  /** Seitenzahl. Wird zweistellig gesetzt. */
  folio: number;
  /** Genau einer je Seite — oder keiner. Nie zwei. */
  weg?: WegAngabe;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`heftseite ton-${ton} aussen-${aussen}${className ? " " + className : ""}`}>
      <div className="heftseite-kopf">
        <span className="heftseite-marke" aria-hidden>
          {aussen === "links" ? <PawnWordmark /> : "✝"}
        </span>
        <span className="heftseite-kolumne">{kolumne}</span>
      </div>

      <div className="heftseite-satz">{children}</div>

      <div className="heftseite-fuss">
        <span className="heft-folio">{String(folio).padStart(2, "0")}</span>
        {weg ? (
          <Link to={weg.zu} className="heftseite-weg">
            {weg.text}<span aria-hidden>→</span>
          </Link>
        ) : <span />}
      </div>
    </div>
  );
}

/* ————— Die Hierarchie. Fest in der Ordnung, frei in den Größen. ————— */

export const Kicker = ({ children }: { children: React.ReactNode }) =>
  <p className="heft-kicker">{children}</p>;

export const Schlagzeile = ({ children }: { children: React.ReactNode }) =>
  <p className="heft-schlagzeile">{children}</p>;

export const Vorspann = ({ children }: { children: React.ReactNode }) =>
  <p className="heft-vorspann">{children}</p>;

export const Fliesstext = ({ children }: { children: React.ReactNode }) =>
  <p className="heft-fliesstext">{children}</p>;

export const Bildunterschrift = ({ children }: { children: React.ReactNode }) =>
  <p className="heft-bildunterschrift">{children}</p>;
