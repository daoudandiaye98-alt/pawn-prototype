/**
 * Teil X5 — Warenkorb und Suche als Marken am Blattrand.
 *
 * „Warenkorb und Suche werden **Marken am Blattrand**, keine Knöpfe in einer
 * Leiste." Eine Leiste über dem Heft wäre eine zweite Oberfläche auf der ersten
 * — genau das, was X1 löscht. Eine Marke liegt am Rand des Papiers, wie ein
 * Lesezeichen, und zeigt nichts an, was nicht zum Heft gehört.
 *
 * Sie sitzen an der linken Kante, weil das Griffregister rechts liegt. Zwei
 * Dinge an derselben Kante würden sich überdecken.
 *
 * **Die Suche ist die Sektion „Frag PAWN".**
 *
 * Das ist keine Verlegenheitslösung, sondern die Ordnung dieses Hefts: gesucht
 * wird hier im Gespräch, nicht in einem Feld. Die Marke führt deshalb an die
 * Adresse dieser Sektion und nicht an ein Suchfeld, das es im Heft nicht gibt.
 *
 * Bewusst **nicht** gebaut: ein Knopf, der das alte Chatfenster öffnet. Dessen
 * Hörer sitzt in `PalaceHeader` — der Kopfzeile, die das Heft nicht mitbringt und
 * die X1 löscht. Ein Knopf, der dort nichts auslöst, wäre ein toter Knopf.
 */
import { Link } from "react-router-dom";
import { useCart } from "@/store/cart";

export interface MarkenProps {
  /** Die Adresse der Sektion „Frag PAWN". */
  suchePfad: string;
  /** Antippen soll blättern, nicht neu laden — für Ziele im Heft. */
  aufSuche: () => void;
}

export function Marken({ suchePfad, aufSuche }: MarkenProps) {
  const { count } = useCart();

  return (
    <div className="hx-marken">
      {/*
        Die Reihenfolge im Band ist Wort, dann Kurzzeichen — und das Band fährt
        nach links aus dem Bild. Sichtbar bleibt also das Kurzzeichen.

        Gemessen war das Gegenteil: bei 1280 px stand im eingefahrenen Band „VN"
        — das Ende von „Frag PAWN". Ein zufällig abgeschnittenes Wort ist kein
        Zeichen. Jetzt steht dort ein Fragezeichen für die Suche und die Zahl für
        den Korb, und das Wort erscheint beim Zeigen.
      */}
      <Link
        to={suchePfad}
        className="hx-marke-band"
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          aufSuche();
        }}
      >
        <span className="hx-marke-wort">Frag PAWN</span>
        <span className="hx-marke-kurz" aria-hidden>?</span>
      </Link>

      {/*
        Der Warenkorb führt aus dem Heft hinaus — bis X9 die Kasse als Beileger
        hereinholt, ist `/cart` die Seite, die es wirklich gibt. Kein Sprung im
        Heft, also ein gewöhnlicher Link ohne abgefangenen Klick.
      */}
      <Link to="/cart" className="hx-marke-band" data-voll={count > 0 || undefined}>
        <span className="hx-marke-wort">Korb</span>
        {/* Die Zahl ist der Inhalt, nicht die Verzierung — sie wird vorgelesen.
            Das Wort davor benennt sie, auch wenn es eingefahren nicht zu sehen
            ist: für eine Vorlesehilfe steht dort „Korb 2", nicht nur „2". */}
        <span className="hx-marke-kurz hx-marke-zahl">{count}</span>
      </Link>
    </div>
  );
}
