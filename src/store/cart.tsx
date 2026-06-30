import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { Product, products } from "@/data/mock";

export interface CartItem {
  product: Product;
  size: string;
  qty: number;
}

interface CartCtx {
  items: CartItem[];
  add: (product: Product, size: string) => void;
  remove: (id: string, size: string) => void;
  setQty: (id: string, size: string, qty: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
}

const Ctx = createContext<CartCtx | null>(null);

interface StoredItem {
  productId: string;
  size: string;
  qty: number;
}

const STORAGE_KEY = "pawn-cart-v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const stored: StoredItem[] = JSON.parse(raw);
      const hydrated = stored
        .map((s) => {
          const product = products.find((p) => p.id === s.productId);
          return product ? { product, size: s.size, qty: s.qty } : null;
        })
        .filter((x): x is CartItem => x !== null);
      setItems(hydrated);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const stored: StoredItem[] = items.map((i) => ({ productId: i.product.id, size: i.size, qty: i.qty }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }, [items]);

  const value = useMemo<CartCtx>(
    () => ({
      items,
      add: (product, size) =>
        setItems((prev) => {
          const existing = prev.find((i) => i.product.id === product.id && i.size === size);
          if (existing) {
            return prev.map((i) => (i === existing ? { ...i, qty: i.qty + 1 } : i));
          }
          return [...prev, { product, size, qty: 1 }];
        }),
      remove: (id, size) => setItems((prev) => prev.filter((i) => !(i.product.id === id && i.size === size))),
      setQty: (id, size, qty) =>
        setItems((prev) =>
          prev
            .map((i) => (i.product.id === id && i.size === size ? { ...i, qty } : i))
            .filter((i) => i.qty > 0),
        ),
      clear: () => setItems([]),
      count: items.reduce((acc, i) => acc + i.qty, 0),
      subtotal: items.reduce((acc, i) => acc + i.qty * i.product.price, 0),
    }),
    [items],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
