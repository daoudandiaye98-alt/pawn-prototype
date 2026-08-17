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
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PawnWordmark } from "@/components/pawn/PawnWordmark";

export type Seitenlage = "links" | "rechts";

export interface HeftseiteProps {
  lage: Seitenlage;
  kolumne: string;
  /** `null` = keine Zahl (Umschlag). */
  folio: number | null;
  /** Höchstens einer je Doppelseite — das gilt für die Doppelseite, nicht die Seite. */
  weg?: { text: string; zu: string };
  children?: ReactNode;
}

/**
 * Die Hülle einer einzelnen Heftseite. Der Inhalt steht in `children` und
 * bekommt vom Satzspiegel nur seinen Platz — nie eine Farbe, nie eine Schrift.
 * Farbe und Schrift kommen vom Ton der Doppelseite (`data-ton` am Blatt).
 */
export function Heftseite({ lage, kolumne, folio, weg, children }: HeftseiteProps) {
  return (
    <div className="hx-seite" data-lage={lage}>
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
        {weg && (
          <Link className="hx-pfad" to={weg.zu}>
            {weg.text}
          </Link>
        )}
      </div>
    </div>
  );
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
