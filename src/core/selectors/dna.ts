/**
 * DNA-as-a-layer selectors.
 *
 * Every surface (card, detail, designer page, cart) reads through these so the
 * rationale a customer sees on a product card matches what they see on the
 * detail page and what a designer sees as audience alignment.
 */
import type { DomainState } from "../reducers/root";
import type { IdentityId, ProductId, DesignerId } from "../types/ids";
import type { GenomeAxis, StyleGenome, Product } from "../types/entities";
import { getIdentity, defaultIdentityId } from "./identity";
import { memoByStateAndKey } from "./memo";

const AXIS_LABEL: Record<GenomeAxis, string> = {
  structure: "Structure",
  edge: "Edge",
  elegance: "Elegance",
  darkness: "Darkness",
  sensuality: "Sensuality",
  utility: "Utility",
};

export interface DnaMatch {
  score: number; // 0..1
  percent: number; // 0..100 rounded
  topAxes: { axis: GenomeAxis; label: string; contribution: number }[];
  rationale: string;
}

const EMPTY_MATCH: DnaMatch = { score: 0, percent: 0, topAxes: [], rationale: "" };

function affinityScore(genome: StyleGenome, affinity: Partial<StyleGenome>): { score: number; contribs: { axis: GenomeAxis; c: number }[] } {
  // Normalized dot product across present affinity axes.
  const axes = Object.keys(affinity) as GenomeAxis[];
  if (axes.length === 0) return { score: 0, contribs: [] };
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const contribs: { axis: GenomeAxis; c: number }[] = [];
  for (const a of axes) {
    const g = (genome[a] ?? 0) / 100; // genome stored 0..100
    const p = affinity[a] ?? 0; // affinity 0..1
    const c = g * p;
    dot += c;
    normA += g * g;
    normB += p * p;
    contribs.push({ axis: a, c });
  }
  const score = normA > 0 && normB > 0 ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
  contribs.sort((x, y) => y.c - x.c);
  return { score, contribs };
}

export function dnaMatchForAffinity(
  state: DomainState,
  affinity: Partial<StyleGenome>,
  identityId: IdentityId = defaultIdentityId,
): DnaMatch {
  const identity = getIdentity(state, identityId);
  if (!identity) return EMPTY_MATCH;
  const { score, contribs } = affinityScore(identity.dna.genome, affinity);
  if (score === 0) return EMPTY_MATCH;
  const top = contribs.slice(0, 2).map((c) => ({ axis: c.axis, label: AXIS_LABEL[c.axis], contribution: c.c }));
  const rationale = top.length
    ? `Matches your ${top.map((t) => t.label.toLowerCase()).join(" & ")} signature.`
    : "";
  return { score, percent: Math.round(score * 100), topAxes: top, rationale };
}

export const dnaMatchForProduct = memoByStateAndKey(
  (state: DomainState, productId: ProductId | string): DnaMatch => {
    const product = state.marketplace.products[productId as string];
    if (!product) return EMPTY_MATCH;
    return dnaMatchForAffinity(state, product.genomeAffinity, defaultIdentityId);
  },
);

/** Alignment between an identity's genome and a designer's aggregate product affinity. */
export function dnaAlignmentForDesigner(state: DomainState, designerId: DesignerId, identityId: IdentityId = defaultIdentityId): DnaMatch {
  const products: Product[] = Object.values(state.marketplace.products).filter((p) => p.designerId === designerId);
  if (products.length === 0) return EMPTY_MATCH;
  const agg: Partial<StyleGenome> = {};
  const counts: Partial<Record<GenomeAxis, number>> = {};
  for (const p of products) {
    for (const axis of Object.keys(p.genomeAffinity) as GenomeAxis[]) {
      agg[axis] = (agg[axis] ?? 0) + (p.genomeAffinity[axis] ?? 0);
      counts[axis] = (counts[axis] ?? 0) + 1;
    }
  }
  for (const axis of Object.keys(agg) as GenomeAxis[]) {
    agg[axis] = (agg[axis] ?? 0) / (counts[axis] ?? 1);
  }
  return dnaMatchForAffinity(state, agg, identityId);
}

/** Impact of the current cart on the wardrobe genome — a preview of the direction it will nudge. */
export function wardrobeImpact(state: DomainState, cartAffinities: Partial<StyleGenome>[], identityId: IdentityId = defaultIdentityId) {
  const identity = getIdentity(state, identityId);
  if (!identity || cartAffinities.length === 0) {
    return { dominant: null as GenomeAxis | null, dominantLabel: "", delta: 0 };
  }
  const totals: Partial<Record<GenomeAxis, number>> = {};
  for (const a of cartAffinities) {
    for (const axis of Object.keys(a) as GenomeAxis[]) {
      totals[axis] = (totals[axis] ?? 0) + (a[axis] ?? 0);
    }
  }
  const sorted = (Object.keys(totals) as GenomeAxis[]).sort((x, y) => (totals[y] ?? 0) - (totals[x] ?? 0));
  const dominant = sorted[0] ?? null;
  return {
    dominant,
    dominantLabel: dominant ? AXIS_LABEL[dominant] : "",
    delta: dominant ? Math.round(((totals[dominant] ?? 0) / cartAffinities.length) * 100) : 0,
  };
}

export const DNA_AXIS_LABEL = AXIS_LABEL;
