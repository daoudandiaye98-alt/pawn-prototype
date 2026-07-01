import type { Identity, Mutation, StyleGenome } from "../types/entities";
import type { MutationId } from "../types/ids";

/**
 * DNA evolution is proposal-then-ratification. Engines/analytics may only propose;
 * only ratifyMutation writes dna.updated. This is the damping requested in the review.
 */

export type Guard = { ok: true } | { ok: false; reason: string };

export function canPropose(identity: Identity, to: Partial<StyleGenome>): Guard {
  const openByAxis = new Set(
    identity.dna.mutations
      .filter((m) => m.status === "proposed")
      .flatMap((m) => Object.keys(m.to)),
  );
  const collision = Object.keys(to).find((axis) => openByAxis.has(axis));
  if (collision) return { ok: false, reason: `Open proposal already exists for axis "${collision}"` };
  return { ok: true };
}

export function findMutation(identity: Identity, mutationId: MutationId): Mutation | undefined {
  return identity.dna.mutations.find((m) => m.id === mutationId);
}

export function applyRatified(genome: StyleGenome, mutation: Mutation): StyleGenome {
  const next: StyleGenome = { ...genome };
  (Object.keys(mutation.to) as (keyof StyleGenome)[]).forEach((axis) => {
    const target = mutation.to[axis];
    if (typeof target === "number") {
      // damping: 60% toward target
      next[axis] = clamp(genome[axis] + (target - genome[axis]) * 0.6);
    }
  });
  return next;
}

function clamp(v: number) { return Math.max(0, Math.min(1, v)); }
