/**
 * Teil X4 — der Satzspiegel.
 *
 * Auf jeder Doppelseite, immer an derselben Stelle:
 *
 *   oben außen     P♟WN                      (Verso — die linke Seite)
 *   oben außen     ✝                         (Rekto — die rechte Seite)
 *   oben innen     der Kolumnentitel
 *   unten außen    Folio, zweistellig, Tabellenziffern
 *
 * **Warum Marke und Zeichen sich abwechseln.** X4 verlangt beide „oben außen".
 * Zwei Dinge an derselben Stelle geht nicht, also trägt die linke Seite die
 * Marke und die rechte das Zeichen — der klassische Wechsel von Verso und
 * Rekto. Oben außen steht damit immer genau ein Zeichen, und die Doppelseite
 * hat beide.
 *
 * „Außen" heißt links auf der linken Seite und rechts auf der rechten. Kopf und
 * Fuß folgen derselben Regel; deshalb gibt es hier nur eine Klasse `aussen`,
 * die aus der Seite ihre Richtung zieht, statt zweier Regeln, die auseinander
 * laufen können.
 */
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { PawnWordmark } from "@/components/pawn/PawnWordmark";

export type Seitenlage = "links" | "rechts";

/**
 * Der eine Weg einer Doppelseite — entweder eine Adresse oder eine Tat.
 *
 * Bis X7 war jeder Weg eine Adresse, weil jede Sektion auf eine andere Sektion
 * zeigte. Ein Werk zeigt auf keine Seite: sein Weg ist „in den Korb" oder
 * „Anfragen" (X7), und beides ist eine Handlung. Deshalb hat der Weg jetzt zwei
 * Naturen — aber weiter nur EINE Stelle, dieselbe Form und dieselbe Regel:
 * höchstens einer je Doppelseite.
 */
export type Weg =
  | { text: string; zu: string; tu?: never }
  | { text: string; tu: () => void; zu?: never };

export interface HeftseiteProps {
  lage: Seitenlage;
  kolumne: string;
  /** `null` = keine Zahl (Umschlag). */
  folio: number | null;
  /** Höchstens einer je Doppelseite — das gilt für die Doppelseite, nicht die Seite. */
  weg?: Weg;
  /**
   * X8 — die Handschrift eines Hauses auf seinen Kapitel-Seiten: Papier, Tinte
   * und Schrift aus dem Haus-Thema. Nur die Kapitel setzen das; für alle
   * anderen Seiten gilt unverändert der Satz unten — Farbe und Schrift kommen
   * vom Ton der Doppelseite.
   */
  hausStil?: { papier: string; tinte: string; schrift: string };
  children?: ReactNode;
}

/**
 * Die Hülle einer einzelnen Heftseite. Der Inhalt steht in `children` und
 * bekommt vom Satzspiegel nur seinen Platz — nie eine Farbe, nie eine Schrift.
 * Farbe und Schrift kommen vom Ton der Doppelseite (`data-ton` am Blatt).
 * Einzige Ausnahme: die Haus-Kapitel (X8, `hausStil`), sichtbar eingezäunt
 * über `data-haus` in `heft.css`.
 */
export function Heftseite({ lage, kolumne, folio, weg, hausStil, children }: HeftseiteProps) {
  return (
    <div
      className="hx-seite"
      data-lage={lage}
      data-haus={hausStil ? "" : undefined}
      style={hausStil ? {
        "--haus-papier": hausStil.papier,
        "--haus-tinte": hausStil.tinte,
        "--haus-schrift": hausStil.schrift,
      } as CSSProperties : undefined}
    >
      <div className="hx-kopf">
        {/* Die Reihenfolge im DOM ist immer außen → innen; welche Seite das
            heißt, entscheidet CSS über `data-lage`. So steht im Markup keine
            Richtung, die man beim Umbau vergessen könnte. */}
        <span className="hx-kopf-aussen" aria-hidden>
          {lage === "links" ? <Wortmarke /> : "†"}
        </span>
        <span className="hx-kolumne">{kolumne}</span>
      </div>

      <div className="hx-satz">{children}</div>

      <div className="hx-fuss">
        {folio !== null && (
          <span className="hx-folio" aria-hidden>{String(folio).padStart(2, "0")}</span>
        )}
        {weg && (weg.zu !== undefined ? (
          <Link className="hx-pfad" to={weg.zu}>
            {weg.text}
            <Pfeil />
          </Link>
        ) : (
          /* Eine Tat ist ein Knopf, kein Link — ein `<a>` ohne Ziel wäre eine
             Adresse, die es nicht gibt. Die Form bleibt dieselbe: es ist
             derselbe Weg an derselben Stelle.
             Ausnahme von Teil 26b wie im Griffregister: das Heft hat seine
             eigene Formfamilie, `<Button>` brächte die des Palasts mit. */
          /* eslint-disable-next-line no-restricted-syntax */
          <button type="button" className="hx-pfad hx-pfad-tat" onClick={weg.tu}>
            {weg.text}
            <Pfeil />
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Der Pfeil am Weg (Teil Ω).
 *
 * Er steht als eigenes Glied und nicht im Text, weil der Abstand zwischen Wort
 * und Pfeil beim Zeigen wächst (14 -> 24 px). Ein Pfeil im Text könnte das
 * nicht — und `aria-hidden`, weil eine Vorlesehilfe „Eintreten" ansagen soll,
 * nicht „Eintreten Pfeil nach rechts".
 */
function Pfeil() {
  return <span className="hx-pfad-pfeil" aria-hidden>&#8594;</span>;
}

/**
 * Die Wortmarke im Kopf.
 *
 * Die echte Komponente, nicht nachgebaut — das ist Designgesetz. Mein erster
 * Versuch schrieb `P♟WN` als Text; gemessen bei 1280 px erschien statt des
 * Bauern ein Dreieck, weil Outfit das Schachzeichen nicht hat und der Browser
 * eine Ersatzschrift nahm. Die Komponente trägt den Bauern als SVG in
 * `currentColor` und färbt sich damit richtig mit dem Ton der Seite.
 */
function Wortmarke() {
  return <PawnWordmark className="hx-marke" />;
}

/* ————————————————— Die Hierarchie ————————————————— */

/*
 * Kicker → Schlagzeile → Vorspann → Fließtext → Bildunterschrift → ein Weg.
 * Sechs Stufen, jede genau einmal je Seite. Wer eine siebte braucht, hat eine
 * Sektion zu viel auf der Seite.
 */

export const Kicker = ({ children }: { children: ReactNode }) => (
  <p className="hx-kicker">{children}</p>
);

/**
 * Die Schlagzeile ist ein `h2`, nicht ein `h1`.
 *
 * Ein Heft hat alle Doppelseiten gleichzeitig im DOM — X12 verlangt echtes HTML
 * und ausdrücklich keine virtualisierte Seitenliste. Wären die Schlagzeilen
 * `h1`, stünden zwölf davon auf einer Adresse, und die Regel „eine `h1` je
 * Adresse" wäre gebrochen, sobald das Heft mehr als eine Sektion hat.
 *
 * Die eine `h1` trägt deshalb die Hülle (`Heft.tsx`): sie nennt den Titel der
 * aufgeschlagenen Doppelseite und geht beim Blättern mit. Ihr Text ist derselbe
 * wie hier — es gibt keinen zweiten Titel, der etwas anderes behauptet.
 */
export const Schlagzeile = ({ children, als: Als = "h2" }: { children: ReactNode; als?: "h2" | "h3" }) => (
  <Als className="hx-schlagzeile">{children}</Als>
);

export const Vorspann = ({ children }: { children: ReactNode }) => (
  <p className="hx-vorspann">{children}</p>
);

export const Fliesstext = ({ children }: { children: ReactNode }) => (
  <p className="hx-fliesstext">{children}</p>
);

export const Bildunterschrift = ({ children }: { children: ReactNode }) => (
  <p className="hx-bildunterschrift">{children}</p>
);
