import type { DomainState } from "../reducers/root";
import type { IdentityId, DesignerId } from "../types/ids";
import type { Cart, Designer, Product, Recommendation } from "../types/entities";
import { defaultIdentityId } from "./identity";
import { buildRecommendations } from "../policies/recommendation";
import { memoByState, memoByStateAndKey } from "./memo";

export const getAllProducts = memoByState((state: DomainState): Product[] =>
  Object.values(state.marketplace.products),
);

export const getAllDesigners = memoByState((state: DomainState): Designer[] =>
  Object.values(state.marketplace.designers),
);

export function getProductBySlug(state: DomainState, slug: string): Product | undefined {
  return Object.values(state.marketplace.products).find((p) => p.slug === slug);
}

export function getDesignerBySlug(state: DomainState, slug: string): Designer | undefined {
  return Object.values(state.marketplace.designers).find((d) => d.slug === slug);
}

export function getDesignerById(state: DomainState, id: string): Designer | undefined {
  return state.marketplace.designers[id];
}

export const getProductsByDesignerId = memoByStateAndKey(
  (state: DomainState, designerId: DesignerId | string): Product[] =>
    Object.values(state.marketplace.products).filter((p) => p.designerId === designerId),
);

export function getProductsByDesignerSlug(state: DomainState, slug: string): Product[] {
  const designer = getDesignerBySlug(state, slug);
  if (!designer) return [];
  return getProductsByDesignerId(state, designer.id);
}

const emptyCartCache = new Map<string, Cart>();
export function getCart(state: DomainState, id: IdentityId = defaultIdentityId): Cart {
  const existing = state.marketplace.carts[id];
  if (existing) return existing;
  let empty = emptyCartCache.get(id);
  if (!empty) { empty = { identityId: id, lines: [] }; emptyCartCache.set(id, empty); }
  return empty;
}

export const getRecommendedProducts = memoByStateAndKey(
  (state: DomainState, id: IdentityId): Recommendation[] => buildRecommendations(state, id),
);

export function getRecommendationsFor(state: DomainState, id: IdentityId = defaultIdentityId): Recommendation[] {
  return getRecommendedProducts(state, id);
}

export const getAlignedDesigners = memoByStateAndKey(
  (state: DomainState, id: IdentityId): Designer[] => {
    const recs = getRecommendedProducts(state, id);
    const seen = new Set<string>();
    const out: Designer[] = [];
    for (const r of recs) {
      const product = state.marketplace.products[r.productId];
      if (!product) continue;
      const designer = state.marketplace.designers[product.designerId];
      if (designer && !seen.has(designer.id)) {
        seen.add(designer.id);
        out.push(designer);
      }
      if (out.length >= 6) break;
    }
    return out;
  },
);
