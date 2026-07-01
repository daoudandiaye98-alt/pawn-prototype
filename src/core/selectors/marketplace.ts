import type { DomainState } from "../reducers/root";
import type { IdentityId } from "../types/ids";
import type { Cart, Designer, Product, Recommendation } from "../types/entities";
import { defaultIdentityId } from "./identity";
import { buildRecommendations } from "../policies/recommendation";

export function getAllProducts(state: DomainState): Product[] {
  return Object.values(state.marketplace.products);
}

export function getAllDesigners(state: DomainState): Designer[] {
  return Object.values(state.marketplace.designers);
}

export function getProductBySlug(state: DomainState, slug: string): Product | undefined {
  return Object.values(state.marketplace.products).find((p) => p.slug === slug);
}

export function getDesignerBySlug(state: DomainState, slug: string): Designer | undefined {
  return Object.values(state.marketplace.designers).find((d) => d.slug === slug);
}

export function getDesignerById(state: DomainState, id: string): Designer | undefined {
  return state.marketplace.designers[id];
}

export function getCart(state: DomainState, id: IdentityId = defaultIdentityId): Cart {
  return state.marketplace.carts[id] ?? { identityId: id, lines: [] };
}

export function getRecommendedProducts(state: DomainState, id: IdentityId = defaultIdentityId): Recommendation[] {
  return buildRecommendations(state, id);
}

export function getAlignedDesigners(state: DomainState, id: IdentityId = defaultIdentityId): Designer[] {
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
}
