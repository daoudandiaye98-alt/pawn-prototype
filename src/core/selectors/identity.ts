import type { DomainState } from "../reducers/root";
import type { IdentityId } from "../types/ids";
import type { GenomeAxis, Mutation, StyleGenome } from "../types/entities";
import { seedIds, seedCustomerOrders } from "../seed";
import { memoByStateAndKey } from "./memo";

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

export const getIdentityDossier = memoByStateAndKey(
  (state: DomainState, id: IdentityId): IdentityDossier | null => {
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
  },
);

/**
 * Customer-facing order digest. Derives from state.marketplace.orders scoped to
 * the identity. Falls back to seed orders for a first-run experience when the
 * signed-out browsing session has no real orders yet.
 */
export interface CustomerOrderView {
  id: string;
  date: string;
  total: number;
  status: string;
  items: { name: string; designer: string }[];
}

export function getCustomerOrders(state: DomainState, id: IdentityId = defaultIdentityId): CustomerOrderView[] {
  const mine = state.marketplace.orders.filter((o) => o.identityId === id);
  if (mine.length === 0) return seedCustomerOrders;
  return mine.map((o) => ({
    id: o.id,
    date: o.placedAt.slice(0, 10),
    total: o.total,
    status: o.status,
    items: o.items.map((it) => {
      const p = state.marketplace.products[it.productId];
      return { name: p?.name ?? "Item", designer: p ? (state.marketplace.designers[p.designerId]?.name ?? "—") : "—" };
    }),
  }));
}
