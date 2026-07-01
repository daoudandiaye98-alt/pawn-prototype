import type { DomainState } from "../reducers/root";
import type { IdentityId } from "../types/ids";
import { buildRecommendations } from "../policies/recommendation";
import type { Recommendation } from "../types/entities";

/** Compute the current recommendation set for an identity. Stateless. */
export function rerankFor(state: DomainState, identityId: IdentityId): Recommendation[] {
  return buildRecommendations(state, identityId);
}
