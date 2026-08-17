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
import { nummerFuerPfad, type Doppelseite } from "./doppelseiten";

/**
 * Ein Reiter, der nicht auf eine Seite springt, sondern eine Wahl trifft — die
 * Filter des Verzeichnisses (X6).
 *
 * **Warum sie hier stehen und nicht in einer eigenen Leiste.** X6 sagt: die
 * Filter SIND das Griffregister. Eine zweite Leiste wäre eine zweite Oberfläche
 * auf der ersten, und genau die löscht X1. Sie sitzen deshalb an derselben
 * Kante, in derselben Form, nur in einer eigenen Gruppe darunter.
 *
 * Ein `<button>` und kein `<a>`: eine gewählte Welt ist keine andere Seite,
 * sondern eine andere Auswahl derselben. Die Adresse führt sie trotzdem mit
 * (`?welt=…`), damit ein gefiltertes Verzeichnis weitergegeben werden kann —
 * das schreibt der Aufrufer in `waehle`, nicht dieses Register.
 */
export interface FilterWahl {
  schluessel: string;
  /** Das Wort, das ausgefahren zu lesen ist. */
  wort: string;
  /** Ein oder zwei Zeichen für den eingefahrenen Streifen. */
  kurz: string;
  gewaehlt: boolean;
  waehle: () => void;
}

export interface FilterGruppe {
  /** Für die Vorlesehilfe: „Welt", „Preis", „Haus". */
  name: string;
  wahl: FilterWahl[];
  /**
   * Die Adresse, auf die eine Wahl aufschlägt.
   *
   * Eine Filterwahl legt das Verzeichnis neu und blättert auf Blatt 1 — sonst
   * stünde man auf Blatt 9 eines Katalogs, der nur noch zwei Blätter hat.
   */
  zu: string;
}

export interface RegisterProps {
  seiten: Doppelseite[];
  /** Die Doppelseite, die gerade aufgeschlagen ist (1-basiert). */
  aktuell: number;
  /** Antippen soll blättern, nicht neu laden — die Hülle bleibt stehen. */
  aufSprung: (nummer: number) => void;
  /** Nur im Verzeichnis besetzt — dort sind die Filter das Register (X6). */
  filter?: FilterGruppe[];
}

export function Register({ seiten, aktuell, aufSprung, filter }: RegisterProps) {
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

  /* Eine Gruppe ohne Wahl wird nicht gezeigt: kein leeres Fach am Blattrand. */
  const gruppen = (filter ?? []).filter((g) => g.wahl.length > 0);

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

      {gruppen.map((g) => (
        <ol key={g.name} className="hx-register-filter" aria-label={g.name}>
          {g.wahl.map((w) => (
            <li key={w.schluessel}>
              {/*
                Ausdrückliche Ausnahme von der Regel aus Teil 26b („nimm
                <Button>"): das Heft hat seinen eigenen Namensraum und seine
                eigene Form. `<Button>` bringt die Gestalt des Palasts mit —
                Ränder, Polster, Zustände —, und die wäre am Blattrand eine
                zweite Bauteilfamilie im Heft. Der Reiter ist die Form, die es
                hier gibt; sie ist die Form der Sektionsreiter daneben.
              */}
              {/* eslint-disable-next-line no-restricted-syntax */}
              <button
                type="button"
                className="hx-reiter hx-reiter-wahl"
                data-hier={w.gewaehlt || undefined}
                /* `aria-pressed` und nicht `aria-current`: das ist ein Schalter,
                   keine Stelle im Heft. Ein zweites Antippen nimmt ihn zurück —
                   dafür ist keine zweite Schaltfläche nötig. */
                aria-pressed={w.gewaehlt}
                onClick={() => {
                  w.waehle();
                  aufSprung(nummerFuerPfad(seiten, g.zu));
                }}
              >
                <span className="hx-reiter-zahl" aria-hidden>{w.kurz}</span>
                <span className="hx-reiter-wort">{w.wort}</span>
              </button>
            </li>
          ))}
        </ol>
      ))}
    </nav>
  );
}
