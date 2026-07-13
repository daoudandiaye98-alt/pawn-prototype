import type { OrderItem } from "../types/entities";
import type { OrderId, ProductId } from "../types/ids";
import { asOrderId } from "../types/ids";
import { productIdBySlug } from "./products";

export interface SeedOrder {
  id: OrderId;
  customerLabel: string;
  total: number;
  placedAt: string;
  items: OrderItem[];
  displayStatus: "Processing" | "Shipped" | "Delivered" | "Returned";
}

const item = (slug: string, unitPrice: number, size = "M", qty = 1): OrderItem => ({
  productId: productIdBySlug(slug) as ProductId, size, qty, unitPrice,
});

export const seedAdminOrders: SeedOrder[] = [];

export const seedCustomerOrders = [];

export const seedRevenueSeries = [12, 18, 16, 24, 28, 22, 31, 36, 33, 41, 47, 52];
export const seedMonthsShort = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
