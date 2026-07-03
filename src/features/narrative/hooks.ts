/**
 * React hooks für die narrative Schicht. Reine Selektor-Anbindung.
 */
import { useStore, selectors } from "@/core";
import { countMoves } from "./moves";
import { getRank } from "./rank";
import { pieceShadow } from "./pieces";

export function useMoves() {
  return useStore((s) => countMoves(s));
}

export function useRank() {
  return useStore((s) => getRank(s));
}

export function usePieceShadow() {
  const identity = useStore((s) => selectors.getIdentity(s));
  return pieceShadow(identity?.dna.genome);
}
