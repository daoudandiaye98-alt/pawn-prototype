/**
 * pieces.ts — Genom → Schachfigur.
 *
 * Der Bauer ist der Startpunkt. Die dominante Genom-Achse eines Nutzers
 * entscheidet, welche Figur er wird, wenn er promoviert. Dies ist keine
 * Klassifikation, sondern eine Richtung — der Schatten der Verwandlung.
 */
import type { GenomeAxis, StyleGenome } from "@/core";

export type Piece = "pawn" | "rook" | "knight" | "bishop" | "queen";

export interface PieceReading {
  piece: Piece;
  label: string;      // deutsch, kurz
  axis: GenomeAxis;   // welche Achse hat entschieden
  quality: string;    // ein Wort — was diese Figur trägt
}

const AXIS_TO_PIECE: Record<GenomeAxis, { piece: Piece; label: string; quality: string }> = {
  structure:  { piece: "rook",   label: "Turm",     quality: "Fundament" },
  edge:       { piece: "knight", label: "Springer", quality: "Sprung" },
  elegance:   { piece: "bishop", label: "Läufer",   quality: "Linie" },
  darkness:   { piece: "queen",  label: "Dame",     quality: "Reichweite" },
  sensuality: { piece: "bishop", label: "Läufer",   quality: "Wärme" },
  utility:    { piece: "rook",   label: "Turm",     quality: "Halt" },
};

/**
 * Der Schatten der Figur — welche Figur wird der Bauer, wenn er sich jetzt
 * verwandelt? Berechnet aus der dominantesten Achse des Genoms.
 */
export function pieceShadow(genome: StyleGenome | null | undefined): PieceReading {
  if (!genome) {
    return { piece: "pawn", label: "Bauer", axis: "structure", quality: "Potenzial" };
  }
  const axes = Object.entries(genome) as [GenomeAxis, number][];
  const [axis] = axes.reduce((best, cur) => (cur[1] > best[1] ? cur : best), axes[0]);
  const p = AXIS_TO_PIECE[axis];
  return { piece: p.piece, label: p.label, axis, quality: p.quality };
}
