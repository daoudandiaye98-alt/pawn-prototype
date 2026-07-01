/**
 * React hooks for DNA-layer selectors. Kept next to the components that consume
 * them so pages don't reach into `@/core/selectors/dna` directly.
 */
import { useStore } from "@/core";
import type { ProductId, DesignerId } from "@/core";
import {
  dnaMatchForProduct,
  dnaAlignmentForDesigner,
  wardrobeImpact,
  dnaMatchForAffinity,
} from "@/core/selectors/dna";
import type { StyleGenome } from "@/core";

export function useDnaMatch(productId: ProductId | string) {
  return useStore((s) => dnaMatchForProduct(s, productId as ProductId));
}

export function useDnaAlignment(designerId: DesignerId | string) {
  return useStore((s) => dnaAlignmentForDesigner(s, designerId as DesignerId));
}

export function useWardrobeImpact(affinities: Partial<StyleGenome>[]) {
  return useStore((s) => wardrobeImpact(s, affinities));
}

export function useDnaMatchForAffinity(affinity: Partial<StyleGenome>) {
  return useStore((s) => dnaMatchForAffinity(s, affinity));
}
