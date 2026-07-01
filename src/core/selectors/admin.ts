import type { DomainState } from "../reducers/root";
import type { Order } from "../types/entities";
import { memoByState } from "./memo";
import { seedRevenueSeries, seedMonthsShort, seedDnaSegments, seedColorTrends } from "../seed";
import type { OrderView } from "../views/product";
import { toOrderView } from "../views/product";

export interface AdminOverview {
  totalRevenue: number;
  ordersCount: number;
  activeProducts: number;
  designerCount: number;
  recentOrders: Order[];
}

export const getAdminOverview = memoByState((state: DomainState): AdminOverview => {
  const orders = state.marketplace.orders;
  return {
    totalRevenue: orders.reduce((sum, o) => sum + o.total, 0),
    ordersCount: orders.length,
    activeProducts: Object.values(state.marketplace.products).filter((p) => p.status === "Active").length,
    designerCount: Object.keys(state.marketplace.designers).length,
    recentOrders: orders.slice(0, 5),
  };
});

export interface PlatformOverview {
  orders: OrderView[];
  revenueSeries: number[];
  months: string[];
  kpis: {
    revenue: number;
    ordersCount: number;
    activeProducts: number;
    designerCount: number;
  };
}

export const getPlatformOverview = memoByState((state: DomainState): PlatformOverview => {
  const orders = state.marketplace.orders.map(toOrderView);
  const kpis = {
    revenue: state.marketplace.orders.reduce((sum, o) => sum + o.total, 0),
    ordersCount: state.marketplace.orders.length,
    activeProducts: Object.values(state.marketplace.products).filter((p) => p.status === "Active").length,
    designerCount: Object.keys(state.marketplace.designers).length,
  };
  return { orders, revenueSeries: seedRevenueSeries, months: seedMonthsShort, kpis };
});

export interface GlobalDnaView {
  segments: { label: string; value: number }[];
  colorTrends: { label: string; value: number }[];
}

export const getGlobalDnaView = memoByState((_state: DomainState): GlobalDnaView => ({
  segments: seedDnaSegments,
  colorTrends: seedColorTrends,
}));
