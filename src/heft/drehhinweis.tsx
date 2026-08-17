/**
 * Der Dreh-Hinweis.
 *
 * Ein Heft ist quer. Statt für das Hochformat ein zweites Layout zu pflegen,
 * bittet das Heft dort ums Drehen — und lässt eine Tür offen für alle, die nicht
 * drehen können.
 *
 * **Die Erkennung läuft nicht über die Kennung des Browsers.** Eine
 * User-Agent-Abfrage rät, welches Gerät da ist; diese drei Bedingungen messen,
 * was tatsächlich der Fall ist:
 *
 *   `orientation: portrait`   das Fenster steht hoch
 *   `max-width: 820px`        es ist schmal — dieselbe Grenze wie im Heft
 *   `pointer: coarse`         bedient wird mit dem Finger
 *
 * Die dritte Bedingung ist die wichtigste. Ohne sie sperrte das Heft auch ein
 * schmal gezogenes Fenster auf dem Schreibtisch aus, obwohl dort nichts zu
 * drehen ist — man zieht das Fenster einfach breiter.
 *
 * **Gemessene Grenze, die hier benannt sein soll:** ein Tablet im Ständer hat
 * ebenfalls einen groben Zeiger. Die meisten sind im Hochformat breiter als
 * 820 px (iPad 810–834 px) und fallen damit heraus; ein iPad Mini mit 744 px
 * fällt hinein und bekommt den Hinweis. Die Tür darunter führt es weiter.
 */
import { useCallback, useEffect, useState } from "react";
import { PawnWordmark } from "@/components/pawn/PawnWordmark";

/** Die eine Frage. Sie steht hier, damit Prüfstand und Heft dieselbe stellen. */
export const HOCHFORMAT =
  "(orientation: portrait) and (max-width: 820px) and (pointer: coarse)";

/**
 * Adressen, die **nie** gesperrt werden.
 *
 * - Die Kasse: sie dreht ohnehin nicht (X9, der Beileger). Wer mitten im Bezahlen
 *   steht, bekommt keine Aufforderung, das Gerät zu drehen.
 * - Die Werkseite: jemand kommt aus einem geteilten Link auf ein einzelnes Werk
 *   und muss es im Hochformat kaufen können. Ein Kaufweg, der am Bildschirmrand
 *   endet, ist kein Kaufweg.
 *
 * Beide Adressen entstehen erst mit X7 und X9. Die Liste steht trotzdem schon
 * hier — sonst wäre die Sperre beim Einzug dieser Seiten schon aktiv und
 * niemand käme auf die Idee, sie zu suchen.
 */
const NIE_SPERREN = ["/kasse", "/werk/"];

export function darfSperren(pfad: string): boolean {
  return !NIE_SPERREN.some((p) => pfad === p || pfad.startsWith(p));
}

/**
 * Steht das Gerät hoch und ist es eins zum Drehen?
 *
 * `aktiv` schaltet die Frage ganz ab — für die Ausnahmen oben und für den
 * Textweg, der die Sperre erübrigt.
 */
export function useHochformat(aktiv: boolean): boolean {
  const [hoch, setHoch] = useState(
    () => aktiv && typeof window !== "undefined" && window.matchMedia?.(HOCHFORMAT).matches === true,
  );

  useEffect(() => {
    if (!aktiv) {
      setHoch(false);
      return;
    }
    const mm = window.matchMedia(HOCHFORMAT);
    const pruefe = () => setHoch(mm.matches);
    pruefe();

    /*
     * Zwei Quellen, mit Absicht.
     *
     * `change` an der Medienabfrage ist der saubere Weg. `orientationchange`
     * kommt dazu, weil einige Browser das Ereignis feuern, BEVOR sie die neuen
     * Maße des Fensters kennen — dort wäre eine sofortige Abfrage noch die alte
     * Antwort. Deshalb wird sie ein Bild später gestellt, wenn die Maße stehen.
     * So verschwindet der Hinweis beim Drehen sofort und nicht erst beim
     * nächsten Antippen.
     */
    const beimDrehen = () => requestAnimationFrame(pruefe);
    mm.addEventListener("change", pruefe);
    window.addEventListener("orientationchange", beimDrehen);
    return () => {
      mm.removeEventListener("change", pruefe);
      window.removeEventListener("orientationchange", beimDrehen);
    };
  }, [aktiv]);

  return hoch;
}

export interface DrehhinweisProps {
  /** Der Weg in die Textfassung — dieselbe Adresse wie der Sprunglink. */
  textAdresse: string;
  aufText: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

/**
 * Der Bildschirm: Tisch-Grund, Wortmarke oben, Zeichen mittig, eine Zeile.
 * Kein Chrom, keine Leiste — und darunter die Tür.
 */
export function Drehhinweis({ textAdresse, aufText }: DrehhinweisProps) {
  return (
    <div className="hx-dreh">
      <div className="hx-korn" aria-hidden />
      <PawnWordmark className="hx-dreh-marke" />

      <div className="hx-dreh-mitte">
        <DrehZeichen />
        {/*
          `role="status"` sagt der Vorlesehilfe, dass hier etwas Neues steht,
          ohne den Fokus zu stehlen. Wer schon liest, wird nicht unterbrochen.
        */}
        <p className="hx-dreh-satz" role="status">
          Bitte dreh dein Gerät ins Querformat.
        </p>
      </div>

      {/*
        Nicht verhandelbar: Wer die Rotationssperre seines Geräts an hat, KANN
        nicht drehen. Ohne diese Tür wäre der Hinweis für ihn eine Sackgasse —
        eine Aufforderung, der er nicht nachkommen kann, und dahinter nichts.
        Deshalb steht sie sichtbar da und nicht erst beim Tastaturfokus.
      */}
      <a className="hx-dreh-tuer" href={textAdresse} onClick={aufText}>
        Das ganze Heft als Text lesen
      </a>
    </div>
  );
}

/**
 * Ein Telefon, das sich dreht. Harte Kanten, 1,5 px, `currentColor` — es ist
 * eine Zeichnung im Stil des Hefts, kein Symbol aus einer fremden Sammlung.
 */
function DrehZeichen() {
  return (
    <svg
      className="hx-dreh-zeichen"
      viewBox="0 0 96 72"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      {/*
        Das hochkant stehende Gerät, Mitte bei (48|32). Seine halbe Diagonale
        misst rund 27,8 — der Bogen läuft deshalb auf Radius 34 und berührt den
        Körper nirgends. Im ersten Entwurf endete der obere Pfeil bei (48|10),
        also mitten im Telefon; das sah man.
      */}
      <rect x="34" y="8" width="28" height="48" />
      <line x1="34" y1="15" x2="62" y2="15" />
      <line x1="34" y1="49" x2="62" y2="49" />

      {/* Der Bogen unter dem Gerät, von links nach rechts, mit Spitze rechts. */}
      <path d="M16 46 A 34 34 0 0 0 80 46" />
      <path d="M72 42 L80 46 L76 54" />
    </svg>
  );
}
