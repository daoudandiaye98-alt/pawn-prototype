/**
 * React hooks for DNA-layer selectors. Kept next to the components that consume
 * them so pages don't reach into `@/core/selectors/dna` directly.
 */
import { useMemo } from "react";
import { useStore } from "@/core";
import type { ProductId, DesignerId } from "@/core";
import {
  dnaMatchForProduct,
  dnaAlignmentForDesigner,
  wardrobeImpactForProducts,
  dnaMatchForAffinity,
} from "@/core/selectors/dna";
import type { StyleGenome } from "@/core";

export function useDnaMatch(productId: ProductId | string) {
  return useStore((s) => dnaMatchForProduct(s, productId as ProductId));
}

export function useDnaAlignment(designerId: DesignerId | string) {
  return useStore((s) => dnaAlignmentForDesigner(s, designerId as DesignerId));
}

export function useCartWardrobeImpact(productIds: (ProductId | string)[]) {
  const key = useMemo(() => productIds.slice().sort().join("|"), [productIds]);
  return useStore((s) => wardrobeImpactForProducts(s, key));
}

export function useDnaMatchForAffinity(affinity: Partial<StyleGenome>) {
  // Not memoized by state (affinity varies) — safe for one-off badges only.
  return useStore((s) => dnaMatchForAffinity(s, affinity));
}
