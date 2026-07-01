import type { DomainState } from "../reducers/root";
import type { EventId, IdentityId, RecommendationId } from "../types/ids";
import { asRecommendationId } from "../types/ids";
import type { GenomeAxis, Identity, Product, Recommendation } from "../types/entities";
import type { Provenance, ReasonCode } from "../types/provenance";

interface Scored {
  product: Product;
  score: number;
  matchedAxes: GenomeAxis[];
  reasons: ReasonCode[];
  sources: EventId[];
}

export function scoreProducts(state: DomainState, identity: Identity): Scored[] {
  const products = Object.values(state.marketplace.products).filter((p) => p.status === "Active");
  const followed = new Set(identity.relationships.follows);
  const saved = new Set(identity.wardrobe.saved);

  return products.map((product) => {
    const matchedAxes: GenomeAxis[] = [];
    let alignment = 0;
    (Object.keys(product.genomeAffinity) as GenomeAxis[]).forEach((axis) => {
      const w = product.genomeAffinity[axis] ?? 0;
      const g = identity.dna.genome[axis];
      const contribution = w * g;
      alignment += contribution;
      if (w >= 0.5 && g >= 0.5) matchedAxes.push(axis);
    });

    const reasons: ReasonCode[] = [];
    if (matchedAxes.length > 0) reasons.push("genome_alignment");
    if (followed.has(product.designerId)) { reasons.push("follows_designer"); alignment += 0.4; }
    if (saved.has(product.id)) { reasons.push("saved_similar"); alignment += 0.2; }
    if (reasons.length === 0) reasons.push("cold_start");

    return {
      product,
      score: Math.round(alignment * 100) / 100,
      matchedAxes,
      reasons,
      sources: [],
    };
  }).sort((a, b) => b.score - a.score);
}

export function buildProvenance(s: Scored, at: string): Provenance {
  const reasonText: string[] = [];
  if (s.matchedAxes.length > 0) {
    reasonText.push(`Matches your ${s.matchedAxes.map((a) => a.charAt(0).toUpperCase() + a.slice(1)).join(" + ")} axis`);
  }
  if (s.reasons.includes("follows_designer")) reasonText.push(`from a designer you follow`);
  if (s.reasons.includes("saved_similar")) reasonText.push(`similar to pieces you've saved`);
  return {
    reason: reasonText.length ? reasonText.join(" · ") : "Editorial pick",
    reasonCodes: s.reasons,
    sourceEventIds: s.sources,
    affectedAxes: s.matchedAxes,
    confidence: Math.min(1, s.score / 2),
    at,
  };
}

export function buildRecommendations(state: DomainState, identityId: IdentityId): Recommendation[] {
  const identity = state.identity.byId[identityId];
  if (!identity) return [];
  const now = new Date().toISOString();
  return scoreProducts(state, identity).slice(0, 12).map((s, i) => ({
    id: asRecommendationId(`rec_${identityId}_${i}`) as RecommendationId,
    identityId,
    productId: s.product.id,
    score: s.score,
    provenance: buildProvenance(s, now),
  }));
}
