/**
 * rank.ts — Der Rang des Bauern (0–8).
 *
 * Rang 0: noch nicht gezogen.
 * Rang 1–7: unterwegs über das Brett.
 * Rang 8: bereit zur Promotion — oder bereits promoviert.
 *
 * Die Berechnung ist bewusst weich: Züge treiben den Rang, ein Kauf zwingt
 * die Promotion. Kein Fortschrittsbalken — ein Zustand.
 */
import type { DomainState } from "@/core/reducers/root";
import type { IdentityId } from "@/core";
import { defaultIdentityId } from "@/core/selectors/identity";
import { countMoves } from "./moves";

export interface RankReading {
  rank: number;           // 0..8
  promoted: boolean;      // rank === 8 und mindestens ein Kauf
  movesToNext: number;    // wie viele Züge bis zum nächsten Rang
}

const MOVES_PER_RANK = 2;

export function getRank(state: DomainState, id: IdentityId = defaultIdentityId): RankReading {
  const { total, breakdown } = countMoves(state, id);
  const raw = Math.floor(total / MOVES_PER_RANK);
  const rank = Math.min(8, Math.max(0, raw));
  const promoted = rank >= 8 && breakdown.purchases > 0;
  const movesToNext = rank >= 8 ? 0 : MOVES_PER_RANK - (total % MOVES_PER_RANK);
  return { rank, promoted, movesToNext };
}
