/**
 * Teil X5 — das Inhaltsverzeichnis auf der linken Seite von Doppelseite 02.
 *
 * Die Navigation lebt im Papier. Das ist der erste der beiden Wege; der zweite
 * ist das Griffregister an der Außenkante (`register.tsx`). Beide sind gebaut,
 * beide führen an dieselben Adressen.
 *
 * **Warum echte Links.** Jede Zeile ist ein `<a>` mit der Adresse ihrer
 * Doppelseite: Mittelklick öffnet einen Tab, die Tabulatortaste läuft durch, eine
 * Suchmaschine findet die Sektionen. Ein `<button>` mit Sprungbefehl könnte das
 * nicht — und X2 verlangt Adressen, keine Befehle.
 *
 * **Warum es sich aus derselben Liste baut wie das Heft.** Es gibt keine zweite
 * Aufzählung der Sektionen, die man synchron halten müsste. Wer eine Sektion
 * einfügt, fügt sie in `spreads/index.tsx` ein — hier erscheint sie von selbst,
 * mit richtiger Nummer und richtigem Folio.
 */
import { Link } from "react-router-dom";
import type { Doppelseite } from "./doppelseiten";
import { folios } from "./doppelseiten";

export interface InhaltsverzeichnisProps {
  seiten: Doppelseite[];
  /** Antippen soll blättern, nicht neu laden — die Hülle bleibt stehen. */
  aufSprung: (nummer: number) => void;
}

export function Inhaltsverzeichnis({ seiten, aufSprung }: InhaltsverzeichnisProps) {
  /*
   * Eine Zeile je Sektion, nicht je Doppelseite.
   *
   * Das Verzeichnis hat viele Doppelseiten (X6). Zwölf Zeilen „Verzeichnis"
   * hintereinander wären kein Inhaltsverzeichnis, sondern eine Seitenliste.
   * Gezeigt wird deshalb die erste Doppelseite jeder Sektion.
   */
  const gesehen = new Set<string>();
  const zeilen = seiten
    .map((s, i) => ({ s, nummer: i + 1 }))
    .filter(({ s }) => {
      if (gesehen.has(s.sektion)) return false;
      gesehen.add(s.sektion);
      return true;
    });

  return (
    <nav className="hx-inhalt" aria-label="Inhalt des Hefts">
      <ol>
        {zeilen.map(({ s, nummer }) => {
          const f = folios(nummer);
          return (
            <li key={s.sektion}>
              <Link
                to={s.pfad}
                className="hx-inhalt-zeile"
                onClick={(e) => {
                  // Fremde Absichten nicht abfangen: neuer Tab, neues Fenster.
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                  e.preventDefault();
                  aufSprung(nummer);
                }}
              >
                <span className="hx-inhalt-nr" aria-hidden>
                  {String(nummer).padStart(2, "0")}
                </span>
                <span className="hx-inhalt-wort">{s.kolumne}</span>
                {/*
                  Die Punktreihe ist Satz, kein Inhalt — sie gehört nicht in den
                  Vorlesebaum. Das Folio dahinter schon: es ist die Seitenzahl,
                  die im Heft auch unten außen steht.
                */}
                <span className="hx-inhalt-punkte" aria-hidden />
                <span className="hx-inhalt-folio">
                  {f.links === null ? "—" : String(f.links).padStart(2, "0")}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
