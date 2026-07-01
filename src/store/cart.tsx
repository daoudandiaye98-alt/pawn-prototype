// Thin adapter over the core store — public API preserved so no page needs to change.
import { useMemo, type ReactNode } from "react";
import type { ProductView } from "@/core";
import { useStore, useCommand, commands, defaultIdentityId, marketplaceSelectors, toProductView } from "@/core";
import type { ProductId } from "@/core/types/ids";

export interface CartItem {
  product: ProductView;
  size: string;
  qty: number;
}

export interface CartCtx {
  items: CartItem[];
  add: (product: ProductView, size: string) => void;
  remove: (id: string, size: string) => void;
  setQty: (id: string, size: string, qty: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
}

/** Kept for API compatibility — CoreProvider now owns state. */
export function CartProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useCart(): CartCtx {
  const cart = useStore((s) => marketplaceSelectors.getCart(s));
  const products = useStore(marketplaceSelectors.getAllProducts);
  const designers = useStore(marketplaceSelectors.getAllDesigners);
  const dispatch = useCommand();

  return useMemo(() => {
    const designerById = new Map(designers.map((d) => [d.id as string, d]));
    const productById = new Map(products.map((p) => [p.id as string, p]));

    const items: CartItem[] = cart.lines
      .map((line) => {
        const product = productById.get(line.productId as string);
        if (!product) return null;
        return {
          product: toProductView(product, designerById.get(product.designerId as string)),
          size: line.size,
          qty: line.qty,
        };
      })
      .filter((x): x is CartItem => x !== null);

    return {
      items,
      count: items.reduce((acc, i) => acc + i.qty, 0),
      subtotal: items.reduce((acc, i) => acc + i.qty * i.product.price, 0),
      add: (product, size) => {
        dispatch(commands.addToCart, { identityId: defaultIdentityId, productId: product.id as ProductId, size });
      },
      remove: (id, size) => {
        dispatch(commands.removeFromCart, { identityId: defaultIdentityId, productId: id as ProductId, size });
      },
      setQty: (id, size, qty) => {
        dispatch(commands.setCartQty, { identityId: defaultIdentityId, productId: id as ProductId, size, qty });
      },
      clear: () => {
        dispatch(commands.clearCart, { identityId: defaultIdentityId });
      },
    };
  }, [cart, products, designers, dispatch]);
}
