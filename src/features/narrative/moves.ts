/**
 * moves.ts — Wie viele Züge hat der Bauer gemacht?
 *
 * Ein Zug ist jede bewusste Entscheidung: die erste Wahl (Licht/Schatten),
 * jedes Speichern, jedes Folgen, jede ratifizierte Mutation, jeder Kauf.
 * Rein aus dem existierenden State abgeleitet — kein neuer State.
 */
import type { DomainState } from "@/core/reducers/root";
import type { IdentityId } from "@/core";
import { getIdentity, defaultIdentityId } from "@/core/selectors/identity";
import { readFirstChoice } from "@/features/os/lastSeen";

export interface MoveCount {
  total: number;
  breakdown: {
    opening: number;   // erste Wahl (0 oder 1)
    saves: number;
    follows: number;
    mutations: number;
    purchases: number;
  };
}

export function countMoves(state: DomainState, id: IdentityId = defaultIdentityId): MoveCount {
  const identity = getIdentity(state, id);
  const opening = readFirstChoice() ? 1 : 0;
  const saves = identity?.wardrobe.saved.length ?? 0;
  const follows = identity?.relationships.follows.length ?? 0;
  const mutations = (identity?.dna.mutations ?? []).filter((m) => m.status === "ratified").length;
  const purchases = state.marketplace.orders.filter((o) => o.identityId === id).length;
  return {
    total: opening + saves + follows + mutations + purchases,
    breakdown: { opening, saves, follows, mutations, purchases },
  };
}

/**
 * Schach-Notation für die Anzeige des letzten Zugs im Header.
 * Nicht semantisch korrekt (keine echten Felder) — nur Rhythmus.
 */
export function moveNotation(index: number, kind: "opening" | "save" | "follow" | "mutation" | "purchase"): string {
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const file = files[index % 8];
  const rank = Math.min(8, 1 + Math.floor(index / 8));
  const prefix = kind === "opening" ? "" : kind === "save" ? "" : kind === "follow" ? "N" : kind === "mutation" ? "" : "x";
  return `${Math.ceil((index + 1) / 2)}. ${prefix}${file}${rank}`;
}
