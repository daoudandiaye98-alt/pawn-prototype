import type { DomainState } from "../reducers/root";
import type { DesignerId } from "../types/ids";

export interface DesignerPortalOverview {
  designerId: DesignerId | null;
  designerName: string;
  productCount: number;
  activeProductCount: number;
  ordersAttributed: number;
  revenueAttributed: number;
}

export function getDesignerPortalOverview(state: DomainState, designerId?: DesignerId): DesignerPortalOverview {
  const designers = Object.values(state.marketplace.designers);
  const designer = designerId ? state.marketplace.designers[designerId] : designers[0];
  if (!designer) {
    return { designerId: null, designerName: "—", productCount: 0, activeProductCount: 0, ordersAttributed: 0, revenueAttributed: 0 };
  }
  const products = Object.values(state.marketplace.products).filter((p) => p.designerId === designer.id);
  const productIds = new Set(products.map((p) => p.id));
  let ordersAttributed = 0;
  let revenueAttributed = 0;
  state.marketplace.orders.forEach((o) => {
    const attributed = o.items.filter((it) => productIds.has(it.productId));
    if (attributed.length === 0) return;
    ordersAttributed += 1;
    revenueAttributed += attributed.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);
  });
  return {
    designerId: designer.id,
    designerName: designer.name,
    productCount: products.length,
    activeProductCount: products.filter((p) => p.status === "Active").length,
    ordersAttributed,
    revenueAttributed,
  };
}
