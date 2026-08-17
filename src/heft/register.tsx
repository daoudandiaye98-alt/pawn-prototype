/**
 * Teil X5 — das Griffregister an der Außenkante.
 *
 * Schmale Reiter, einer je Sektion, der aktuelle hervorgehoben. Antippen
 * springt. Es ist die zweite Navigation neben dem Inhaltsverzeichnis auf
 * Doppelseite 02 — und die einzige, die dauerhaft sichtbar ist.
 *
 * **Warum das keine Leiste ist.** X1 löscht die Kopfzeile, weil eine Leiste über
 * dem Heft eine zweite Oberfläche auf der ersten wäre. Das Register ist keine
 * Leiste: es liegt am Rand des *Papiers*, wie die Griffe eines Registerbuchs,
 * und es zeigt nichts an, was nicht eine Seite dieses Hefts ist.
 *
 * **Warum echte Links.** Jeder Reiter ist ein `<a>` mit der Adresse seiner
 * Doppelseite. Mittelklick öffnet einen neuen Tab, Rechtsklick kann kopieren,
 * die Tabulatortaste läuft durch. Ein `<button>` mit `scrollTo` könnte das alles
 * nicht — und X2 verlangt Adressen, keine Sprungbefehle.
 */
import { Link } from "react-router-dom";
import type { Doppelseite } from "./doppelseiten";

export interface RegisterProps {
  seiten: Doppelseite[];
  /** Die Doppelseite, die gerade aufgeschlagen ist (1-basiert). */
  aktuell: number;
  /** Antippen soll blättern, nicht neu laden — die Hülle bleibt stehen. */
  aufSprung: (nummer: number) => void;
}

export function Register({ seiten, aktuell, aufSprung }: RegisterProps) {
  const reiter = seiten
    .map((s, i) => ({ s, nummer: i + 1 }))
    .filter((r) => r.s.reiter);

  if (reiter.length === 0) return null;

  /*
   * Hervorgehoben wird die Sektion, nicht die Doppelseite.
   *
   * Gemessen war: auf `/verzeichnis/3` stand kein Reiter auf „hier", weil nur
   * `/verzeichnis/1` den Reiter trägt. Ein Register ohne Markierung sagt dem
   * Leser, er sei nirgends — und das ist auf Seite drei des Katalogs falsch.
   */
  const hierSektion = seiten[aktuell - 1]?.sektion;

  return (
    <nav className="hx-register" aria-label="Sektionen">
      <ol>
        {reiter.map(({ s, nummer }) => {
          const hier = s.sektion === hierSektion;
          return (
            <li key={s.schluessel}>
              <Link
                to={s.pfad}
                className="hx-reiter"
                data-hier={hier || undefined}
                /* `aria-current="page"` ist die Ansage für die Vorlesehilfe:
                   nicht „hervorgehoben", sondern „hier stehst du". */
                aria-current={hier ? "page" : undefined}
                onClick={(e) => {
                  // Fremde Absichten nicht abfangen: neuer Tab, neues Fenster,
                  // Download — alles bleibt dem Browser überlassen.
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                  e.preventDefault();
                  aufSprung(nummer);
                }}
              >
                <span className="hx-reiter-zahl" aria-hidden>{String(nummer).padStart(2, "0")}</span>
                <span className="hx-reiter-wort">{s.reiter}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
