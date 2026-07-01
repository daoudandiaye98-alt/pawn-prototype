import type { DomainState } from "../reducers/root";
import type { IdentityId } from "../types/ids";
import type { GenomeAxis, Mutation, StyleGenome } from "../types/entities";
import { seedIds } from "../seed";

export const defaultIdentityId: IdentityId = seedIds.meIdentityId;

export function getIdentity(state: DomainState, id: IdentityId = defaultIdentityId) {
  return state.identity.byId[id];
}

export function getStyleGenome(state: DomainState, id: IdentityId = defaultIdentityId): StyleGenome | null {
  return getIdentity(state, id)?.dna.genome ?? null;
}

export function getMutationPath(state: DomainState, id: IdentityId = defaultIdentityId): Mutation[] {
  return getIdentity(state, id)?.dna.mutations ?? [];
}

export interface IdentityDossier {
  identityId: IdentityId;
  displayName: string;
  genome: StyleGenome | null;
  topAxes: { axis: GenomeAxis; value: number }[];
  savedCount: number;
  followsCount: number;
  version: number;
  mutations: Mutation[];
}

export function getIdentityDossier(state: DomainState, id: IdentityId = defaultIdentityId): IdentityDossier | null {
  const identity = getIdentity(state, id);
  if (!identity) return null;
  const axes = (Object.keys(identity.dna.genome) as GenomeAxis[])
    .map((axis) => ({ axis, value: identity.dna.genome[axis] }))
    .sort((a, b) => b.value - a.value);
  return {
    identityId: identity.id,
    displayName: identity.profile.displayName,
    genome: identity.dna.genome,
    topAxes: axes.slice(0, 3),
    savedCount: identity.wardrobe.saved.length,
    followsCount: identity.relationships.follows.length,
    version: identity.dna.version,
    mutations: identity.dna.mutations,
  };
}
