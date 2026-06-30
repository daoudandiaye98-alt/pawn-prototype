import { create } from "zustand";
import { Product } from "@/data/mock";

interface CartItem {
  product: Product;
  size: string;
  qty: number;
}

interface CartState {
  items: CartItem[];
  add: (product: Product, size: string) => void;
  remove: (id: string, size: string) => void;
  setQty: (id: string, size: string, qty: number) => void;
  clear: () => void;
  count: () => number;
  subtotal: () => number;
}

export const useCart = create<CartState>((set, get) => ({
  items: [],
  add: (product, size) =>
    set((s) => {
      const existing = s.items.find((i) => i.product.id === product.id && i.size === size);
      if (existing) {
        return {
          items: s.items.map((i) =>
            i === existing ? { ...i, qty: i.qty + 1 } : i,
          ),
        };
      }
      return { items: [...s.items, { product, size, qty: 1 }] };
    }),
  remove: (id, size) =>
    set((s) => ({ items: s.items.filter((i) => !(i.product.id === id && i.size === size)) })),
  setQty: (id, size, qty) =>
    set((s) => ({
      items: s.items
        .map((i) => (i.product.id === id && i.size === size ? { ...i, qty } : i))
        .filter((i) => i.qty > 0),
    })),
  clear: () => set({ items: [] }),
  count: () => get().items.reduce((acc, i) => acc + i.qty, 0),
  subtotal: () => get().items.reduce((acc, i) => acc + i.qty * i.product.price, 0),
}));
