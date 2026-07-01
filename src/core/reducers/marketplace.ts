import type { DomainEvent } from "../types/events";
import type {
  Brand, Cart, Collection, Designer, Order, Product, Recommendation,
} from "../types/entities";
import type { IdentityId } from "../types/ids";

export interface MarketplaceSlice {
  designers: Record<string, Designer>;
  brands: Record<string, Brand>;
  products: Record<string, Product>;
  collections: Record<string, Collection>;
  orders: Order[];
  carts: Record<string, Cart>; // key: identityId
  recommendations: Record<string, Recommendation[]>; // key: identityId
}

export const initialMarketplaceSlice: MarketplaceSlice = {
  designers: {}, brands: {}, products: {}, collections: {},
  orders: [], carts: {}, recommendations: {},
};

function ensureCart(slice: MarketplaceSlice, id: IdentityId): Cart {
  return slice.carts[id] ?? { identityId: id, lines: [] };
}

export function marketplaceReducer(slice: MarketplaceSlice, event: DomainEvent): MarketplaceSlice {
  switch (event.type) {
    case "designer.registered":
      return { ...slice, designers: { ...slice.designers, [event.payload.designer.id]: event.payload.designer } };
    case "brand.registered":
      return { ...slice, brands: { ...slice.brands, [event.payload.brand.id]: event.payload.brand } };
    case "product.registered":
      return { ...slice, products: { ...slice.products, [event.payload.product.id]: event.payload.product } };
    case "collection.registered":
      return { ...slice, collections: { ...slice.collections, [event.payload.collection.id]: event.payload.collection } };
    case "order.placed": {
      const order: Order = {
        id: event.payload.orderId,
        identityId: event.payload.identityId,
        customerLabel: event.payload.customerLabel,
        items: event.payload.items,
        total: event.payload.total,
        status: "Processing",
        placedAt: event.payload.placedAt,
      };
      return { ...slice, orders: [order, ...slice.orders] };
    }
    case "cart.item_added": {
      const cart = ensureCart(slice, event.payload.identityId);
      const idx = cart.lines.findIndex((l) => l.productId === event.payload.productId && l.size === event.payload.size);
      const lines = idx >= 0
        ? cart.lines.map((l, i) => (i === idx ? { ...l, qty: l.qty + 1 } : l))
        : [...cart.lines, { productId: event.payload.productId, size: event.payload.size, qty: 1 }];
      return { ...slice, carts: { ...slice.carts, [event.payload.identityId]: { ...cart, lines } } };
    }
    case "cart.item_removed": {
      const cart = ensureCart(slice, event.payload.identityId);
      const lines = cart.lines.filter((l) => !(l.productId === event.payload.productId && l.size === event.payload.size));
      return { ...slice, carts: { ...slice.carts, [event.payload.identityId]: { ...cart, lines } } };
    }
    case "cart.qty_set": {
      const cart = ensureCart(slice, event.payload.identityId);
      const lines = cart.lines
        .map((l) => (l.productId === event.payload.productId && l.size === event.payload.size ? { ...l, qty: event.payload.qty } : l))
        .filter((l) => l.qty > 0);
      return { ...slice, carts: { ...slice.carts, [event.payload.identityId]: { ...cart, lines } } };
    }
    case "cart.cleared": {
      const cart = ensureCart(slice, event.payload.identityId);
      return { ...slice, carts: { ...slice.carts, [event.payload.identityId]: { ...cart, lines: [] } } };
    }
    case "recommendation.reranked":
      // Recommendations are attached externally via engines/marketplace; reducer keeps the identity slot alive.
      return slice.recommendations[event.payload.identityId]
        ? slice
        : { ...slice, recommendations: { ...slice.recommendations, [event.payload.identityId]: [] } };
    default:
      return slice;
  }
}
