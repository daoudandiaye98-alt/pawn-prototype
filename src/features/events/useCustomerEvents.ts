/**
 * Customer event emitters — the missing bridge between UI interactions and the
 * domain event log. Anonymous browsing keeps events local; authenticated users
 * persist them via the Supabase adapter (see CoreProvider whitelist).
 */
import { useCallback } from "react";
import { useCommand, defaultIdentityId, commands } from "@/core";
import type { ProductId, DesignerId } from "@/core";

export function useCustomerEvents() {
  const dispatch = useCommand();

  const viewProduct = useCallback((productId: ProductId | string, dwellMs?: number) => {
    dispatch(commands.recordProductView, {
      identityId: defaultIdentityId,
      productId: productId as ProductId,
      dwellMs,
    });
  }, [dispatch]);

  const saveProduct = useCallback((productId: ProductId | string) => {
    dispatch(commands.saveProduct, {
      identityId: defaultIdentityId,
      productId: productId as ProductId,
    });
  }, [dispatch]);

  const followDesigner = useCallback((designerId: DesignerId | string) => {
    dispatch(commands.followDesigner, {
      identityId: defaultIdentityId,
      designerId: designerId as DesignerId,
    });
  }, [dispatch]);

  return { viewProduct, saveProduct, followDesigner };
}
