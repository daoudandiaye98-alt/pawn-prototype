import { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * PawnWordmark — the brand law.
 * Renders "P[♟]WN": Playfair Display 600 with an inline SVG pawn glyph
 * replacing the "A". Uses currentColor so it inverts on hover / dark blocks.
 */
export function PawnWordmark({
  className,
  style,
  as: Tag = "span",
  gliedern = false,
}: {
  className?: string;
  style?: CSSProperties;
  as?: "span" | "h1" | "h2" | "div";
  /**
   * Teil M3 — die Eröffnung zieht die Sperrung der Wortmarke zusammen. Weil nur
   * `transform` und `opacity` bewegt werden dürfen (M0), kann dafür nicht
   * `letter-spacing` animiert werden; stattdessen bekommt jedes Glied eine eigene
   * Hülle mit laufender Nummer, die einzeln verschoben wird. Die Marke selbst
   * bleibt unverändert — hier entsteht nur ein Griff für die Bewegung.
   */
  gliedern?: boolean;
}) {
  const glied = (i: number, inhalt: React.ReactNode) =>
    gliedern
      ? <span className="pawn-glied" style={{ ["--i" as string]: i }} aria-hidden>{inhalt}</span>
      : inhalt;

  return (
    <Tag
      className={cn(
        "inline-flex items-baseline leading-none tracking-tight",
        "font-[Playfair_Display] font-semibold uppercase select-none",
        className,
      )}
      style={{ letterSpacing: "-0.02em", ...style }}
      aria-label="PAWN"
    >
      {glied(0, <span aria-hidden>P</span>)}
      {glied(1, <PawnGlyph />)}
      {glied(2, <span aria-hidden>WN</span>)}
    </Tag>
  );
}

function PawnGlyph() {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden
      style={{
        height: "0.94em",
        width: "0.86em",
        transform: "translateY(0.06em)",
        display: "inline-block",
        fill: "currentColor",
      }}
    >
      <path d="M50 4c11 0 20 9 20 20 0 7.5-4.1 14-10.2 17.4 1.5 1.5 2.4 3.5 2.4 5.8 0 2.6-1.2 4.9-3.1 6.4C63.4 60 68 70.8 69.6 82H30.4C32 70.8 36.6 60 40.9 53.6c-1.9-1.5-3.1-3.8-3.1-6.4 0-2.3.9-4.3 2.4-5.8C34.1 38 30 31.5 30 24c0-11 9-20 20-20zM22 88h56l6 10H16z" />
    </svg>
  );
}
