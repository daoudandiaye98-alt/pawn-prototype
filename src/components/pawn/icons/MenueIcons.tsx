import { SVGProps } from "react";

/**
 * DIE MENÜ-IKONEN (Teil T).
 *
 * Elf Zeichen für die elf Zeilen des aufgeklappten Menüs. Acht davon sind nach
 * gelieferten Vorlagen nachgezeichnet, drei (Start, Boutique, Vision) sind im
 * gleichen Stil selbst gezeichnet — gleiche Motive, gleiche Schlichtheit.
 *
 * Warum gezeichnet und nicht als Bild eingebunden:
 *   · gestochen scharf in jeder Größe, egal ob 22 px im Menü oder 40 px sonstwo
 *   · kein weißer Kasten auf dunklem Grund — es gibt keinen Hintergrund
 *   · `currentColor` heißt: das Zeichen hat die Farbe seiner Schrift. Im
 *     Abendlicht des Studios wird es also von selbst hell statt schwarz.
 *
 * Ein Gesetz für alle: quadratische viewBox 24×24, eine Farbe, Strichstärke
 * 1.5, runde Enden. Nichts ist gefüllt, nichts hat eine zweite Farbe.
 */

const BASE: SVGProps<SVGSVGElement> = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

/** Start — der Eingangsbogen: eine Tür, die offen steht. */
export function IkoneStart(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} aria-hidden="true" {...props}>
      <path d="M5 20.5 V11 a7 7 0 0 1 14 0 V20.5" />
      <path d="M2.5 20.5 H21.5" />
      <circle cx="15.6" cy="14.4" r="0.9" />
    </svg>
  );
}

/** Boutique — die Kleiderstange: zwei Bügel auf einem Ständer. */
export function IkoneBoutique(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} aria-hidden="true" {...props}>
      {/* Stange und Ständer */}
      <path d="M2.8 6 H21.2" />
      <path d="M6 6 V20.6" />
      <path d="M18 6 V20.6" />
      <path d="M3.7 20.6 H8.3" />
      <path d="M15.7 20.6 H20.3" />
      {/* Zwei Bügel, mit dem Haken über der Stange */}
      <path d="M9.7 8.3 V6.9 A1 1 0 1 0 8.7 5.9" />
      <path d="M7.3 13.6 L9.7 8.3 L12.1 13.6 Z" />
      <path d="M15 8.3 V6.9 A1 1 0 1 0 14 5.9" />
      <path d="M12.6 13.6 L15 8.3 L17.4 13.6 Z" />
    </svg>
  );
}

/** Vision — das Auge: was PAWN sieht, bevor es alle sehen. */
export function IkoneVision(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} aria-hidden="true" {...props}>
      <path d="M2.4 12 C5.4 7.1 8.6 5.6 12 5.6 C15.4 5.6 18.6 7.1 21.6 12 C18.6 16.9 15.4 18.4 12 18.4 C8.6 18.4 5.4 16.9 2.4 12 Z" />
      <circle cx="12" cy="12" r="2.7" />
    </svg>
  );
}

/** Deine Boutique — der eigene Laden: Markise mit dem Bauern darin. */
export function IkoneDeineBoutique(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} aria-hidden="true" {...props}>
      {/* Markise */}
      <path d="M2.4 10.6 L5.8 4.6 H18.2 L21.6 10.6 Z" />
      <path d="M8.9 4.6 L7.5 10.6" />
      <path d="M15.1 4.6 L16.5 10.6" />
      <path d="M2.4 10.6 a3.2 3.2 0 0 0 6.4 0 a3.2 3.2 0 0 0 6.4 0 a3.2 3.2 0 0 0 6.4 0" />
      {/* Ladenkörper */}
      <path d="M4.6 12.2 V20.6 H19.4 V12.2" />
      {/* Der Bauer darin */}
      <circle cx="12" cy="14.8" r="1.3" />
      <path d="M10.9 16.5 H13.1" />
      <path d="M10.2 19.4 C10.2 17.7 11 17.2 11.1 16.5" />
      <path d="M13.8 19.4 C13.8 17.7 13 17.2 12.9 16.5" />
      <path d="M9.6 19.4 H14.4" />
    </svg>
  );
}

/** Mode — der Bügel mit einem Stück Stoff darüber. */
export function IkoneMode(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} aria-hidden="true" {...props}>
      {/* Haken */}
      <path d="M12 8.4 V7.3 A1.7 1.7 0 1 0 10.3 5.6" />
      {/* Bügel */}
      <path d="M12 8.4 L3.5 13.9 H20.5 Z" />
      {/* Das Stück, darübergelegt */}
      <path d="M8.1 12.1 H15.9 L17 19.6 C14.6 20.9 10.7 19.3 7 20.6 Z" />
      <path d="M10.4 15 L9.9 20.2" />
      <path d="M15.2 14.4 L16.3 18.9" />
    </svg>
  );
}

/** Interior — der Sessel von der Seite. */
export function IkoneInterior(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} aria-hidden="true" {...props}>
      {/* Rückenlehne */}
      <path d="M6.3 5 H8.6 A1.9 1.9 0 0 1 10.4 6.3 L12.6 14.8" />
      <path d="M6.3 5 L10.2 16.2" />
      {/* Sitz */}
      <path d="M8.4 10.2 H16.4 A2.2 2.2 0 0 1 18.5 11.8 L19.1 14" />
      <path d="M11.4 14.2 C12.6 12.6 14 12.2 16.2 12 L19 11.9" />
      <path d="M10.2 16.2 L18.9 15.4" />
      {/* Armlehne */}
      <path d="M18.7 11.9 A2 2 0 0 1 20.4 14 V15.2 L18.9 15.4" />
      {/* Beine */}
      <path d="M10.2 16.2 L7.6 19.4" />
      <path d="M18.5 15.5 L19.3 19.4" />
    </svg>
  );
}

/** Kunst — das gerahmte Bild am Nagel. */
export function IkoneKunst(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} aria-hidden="true" {...props}>
      <circle cx="12" cy="3.5" r="0.9" />
      <path d="M11.4 4.2 L6.4 8.2" />
      <path d="M12.6 4.2 L17.6 8.2" />
      <path d="M3.8 8.2 H20.2 V19.6 H3.8 Z" />
      <path d="M6 10.4 H18 V17.4 H6 Z" />
      <path d="M3.8 8.2 L6 10.4" />
      <path d="M20.2 8.2 L18 10.4" />
      <path d="M3.8 19.6 L6 17.4" />
      <path d="M20.2 19.6 L18 17.4" />
      {/* Der Pinselstrich darin */}
      <path d="M8.6 15.8 C8.4 12.8 11.2 11.9 11.6 13.9 C11.9 15.5 12.7 15.9 13.4 14.6 C14 13.6 15.3 13.9 15.2 15.5" />
    </svg>
  );
}

/** Unsere Häuser — drei Häuser nebeneinander, jedes mit eigener Tür. */
export function IkoneHaeuser(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} aria-hidden="true" {...props}>
      {/* Haus links */}
      <path d="M1.7 12.5 L5.75 8.2 L9.8 12.5" />
      <path d="M2.6 11.5 V18.2" />
      <path d="M8.9 11.5 V18.2" />
      <path d="M2.6 18.2 H4.5 V14.8 H6.6 V18.2 H8.9" />
      {/* Haus in der Mitte */}
      <path d="M8.5 11.6 L12 7 L15.5 11.6" />
      <path d="M9.5 10.3 V18.2" />
      <path d="M14.5 10.3 V18.2" />
      <path d="M9.5 18.2 H14.5" />
      {/* Haus rechts */}
      <path d="M14.2 12.5 L18.25 8.2 L22.3 12.5" />
      <path d="M15.1 11.5 V18.2" />
      <path d="M21.4 11.5 V18.2" />
      <path d="M15.1 18.2 H17.4 V14.8 H19.5 V18.2 H21.4" />
    </svg>
  );
}

/** Deine DNA — die Doppelhelix, diagonal, mit vier Sprossen. */
export function IkoneDna(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} aria-hidden="true" {...props}>
      <path d="M3.3 17.3 C4.6 15.6 6.6 15.5 8.5 15.5 C10.6 15.5 12.4 15.6 13.7 13.7 C15 11.8 15.5 10.4 15.5 8.5 C15.5 6.6 15.6 4.6 17.3 3.3" />
      <path d="M6.7 20.7 C8.4 19 8.5 17.4 8.5 15.5 C8.5 13.6 8.4 11.6 10.3 10.3 C12.2 9 13.6 8.5 15.5 8.5 C17.4 8.5 19 8.4 20.7 6.7" />
      <path d="M8.9 13.1 L10.9 15.1" />
      <path d="M9.7 11.1 L12.9 14.3" />
      <path d="M11.1 9.7 L14.3 12.9" />
      <path d="M13.1 8.9 L15.1 10.9" />
    </svg>
  );
}

/** Für Designer — jemand macht den Schritt auf das erste Feld. */
export function IkoneFuerDesigner(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} aria-hidden="true" {...props}>
      {/* Das Feld, auf das der Schritt geht */}
      <path d="M13 16.4 H20.6 L21.8 20.8 H10.8 Z" />
      {/* Kopf und Rumpf */}
      <circle cx="8" cy="4.4" r="2.2" />
      <path d="M8 6.6 V13" />
      {/* Arme */}
      <path d="M8 8.4 L4.6 11.3" />
      <path d="M8 8.4 L12.8 10" />
      {/* Der Schritt */}
      <path d="M8 13 L5.6 19.2 H7.2" />
      <path d="M8 13 L12.5 17.6 H14.9" />
      {/* Die Richtung */}
      <path d="M15.4 11.8 H19.6" />
      <path d="M18.4 10.6 L19.6 11.8 L18.4 13" />
    </svg>
  );
}

/** Frag PAWN — die Sprechblase mit dem Bauern darin. */
export function IkoneFragPawn(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} aria-hidden="true" {...props}>
      <path d="M6.5 4 H17.5 A3 3 0 0 1 20.5 7 V14.5 A3 3 0 0 1 17.5 17.5 H10.6 L6.2 21.4 V17.5 A3 3 0 0 1 3.5 14.5 V7 A3 3 0 0 1 6.5 4 Z" />
      <circle cx="12" cy="6.9" r="1.7" />
      <path d="M9.9 9.6 H14.1" />
      <path d="M9.9 14.4 C9.9 12.5 11.1 11.5 11.2 9.6" />
      <path d="M14.1 14.4 C14.1 12.5 12.9 11.5 12.8 9.6" />
      <path d="M9.3 14.4 H14.7" />
    </svg>
  );
}
