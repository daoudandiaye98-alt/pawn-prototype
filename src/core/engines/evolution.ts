import type { DomainState } from "../reducers/root";
import type { IdentityId } from "../types/ids";
import type { RawEvent } from "../events/emit";
import { proposeMutation } from "../commands";

/**
 * Analyses recent signals (saves/follows) and *proposes* mutations to the DNA.
 * Never writes dna.updated directly — that requires ratifyMutation.
 */
export function proposeFromSignals(state: DomainState, identityId: IdentityId): RawEvent[] {
  const identity = state.identity.byId[identityId];
  if (!identity) return [];
  const savedCount = identity.wardrobe.saved.length;
  if (savedCount < 3) return [];
  const result = proposeMutation(state, {
    identityId,
    to: { structure: Math.min(1, identity.dna.genome.structure + 0.1) },
    rationale: `Saved ${savedCount} architectural pieces recently.`,
  });
  return result.ok ? result.events : [];
}
