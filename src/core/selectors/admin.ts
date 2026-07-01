import type { DomainState } from "../reducers/root";
import type { Order } from "../types/entities";

export interface AdminOverview {
  totalRevenue: number;
  ordersCount: number;
  activeProducts: number;
  designerCount: number;
  recentOrders: Order[];
}

export function getAdminOverview(state: DomainState): AdminOverview {
  const orders = state.marketplace.orders;
  return {
    totalRevenue: orders.reduce((sum, o) => sum + o.total, 0),
    ordersCount: orders.length,
    activeProducts: Object.values(state.marketplace.products).filter((p) => p.status === "Active").length,
    designerCount: Object.keys(state.marketplace.designers).length,
    recentOrders: orders.slice(0, 5),
  };
}
