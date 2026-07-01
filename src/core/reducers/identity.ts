import type { DomainEvent } from "../types/events";
import type { IdentityId } from "../types/ids";
import type { Identity, StyleGenome } from "../types/entities";

export interface IdentitySlice {
  byId: Record<string, Identity>;
}

export const emptyGenome: StyleGenome = {
  structure: 0, edge: 0, elegance: 0, darkness: 0, sensuality: 0, utility: 0,
};

export const initialIdentitySlice: IdentitySlice = { byId: {} };

function upd(slice: IdentitySlice, id: IdentityId, mut: (i: Identity) => Identity): IdentitySlice {
  const cur = slice.byId[id];
  if (!cur) return slice;
  return { byId: { ...slice.byId, [id]: mut(cur) } };
}

export function identityReducer(slice: IdentitySlice, event: DomainEvent): IdentitySlice {
  switch (event.type) {
    case "identity.created": {
      const { identityId, profile } = event.payload;
      return {
        byId: {
          ...slice.byId,
          [identityId]: {
            id: identityId,
            profile,
            dna: { genome: { ...emptyGenome }, signals: [], mutations: [], version: 0, updatedAt: event.at },
            wardrobe: { saved: [], owned: [], considered: [] },
            relationships: { follows: [], muted: [] },
            memory: { allow: ["saved_products", "viewed_products", "followed_designers", "orders", "dna_signals"], deny: [] },
            createdAt: event.at,
          },
        },
      };
    }
    case "profile.updated":
      return upd(slice, event.payload.identityId, (i) => ({ ...i, profile: { ...i.profile, ...event.payload.patch } }));
    case "product.viewed":
      return upd(slice, event.payload.identityId, (i) => (
        i.wardrobe.considered.includes(event.payload.productId)
          ? i
          : { ...i, wardrobe: { ...i.wardrobe, considered: [...i.wardrobe.considered, event.payload.productId] } }
      ));
    case "product.saved":
      return upd(slice, event.payload.identityId, (i) => (
        i.wardrobe.saved.includes(event.payload.productId)
          ? i
          : { ...i, wardrobe: { ...i.wardrobe, saved: [...i.wardrobe.saved, event.payload.productId] } }
      ));
    case "designer.followed":
      return upd(slice, event.payload.identityId, (i) => (
        i.relationships.follows.includes(event.payload.designerId)
          ? i
          : { ...i, relationships: { ...i.relationships, follows: [...i.relationships.follows, event.payload.designerId] } }
      ));
    case "dna.signal_recorded":
      return upd(slice, event.payload.identityId, (i) => ({
        ...i, dna: { ...i.dna, signals: [...i.dna.signals, event.payload.signal] },
      }));
    case "mutation.proposed":
      return upd(slice, event.payload.identityId, (i) => ({
        ...i, dna: { ...i.dna, mutations: [...i.dna.mutations, event.payload.mutation] },
      }));
    case "mutation.ratified":
      return upd(slice, event.payload.identityId, (i) => ({
        ...i,
        dna: {
          ...i.dna,
          mutations: i.dna.mutations.map((m) =>
            m.id === event.payload.mutationId ? { ...m, status: "ratified", resolvedAt: event.at } : m,
          ),
        },
      }));
    case "mutation.rejected":
      return upd(slice, event.payload.identityId, (i) => ({
        ...i,
        dna: {
          ...i.dna,
          mutations: i.dna.mutations.map((m) =>
            m.id === event.payload.mutationId ? { ...m, status: "rejected", resolvedAt: event.at } : m,
          ),
        },
      }));
    case "dna.updated":
      return upd(slice, event.payload.identityId, (i) => ({
        ...i,
        dna: { ...i.dna, genome: event.payload.genome, version: event.payload.version, updatedAt: event.at },
      }));
    default:
      return slice;
  }
}
