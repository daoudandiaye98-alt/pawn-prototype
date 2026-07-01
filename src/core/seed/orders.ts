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

export const seedAdminOrders: SeedOrder[] = [
  { id: asOrderId("PWN-10241"), customerLabel: "A. Vogt", total: 1450, placedAt: "2026-06-28", items: [item("asymmetric-coat", 1450)], displayStatus: "Shipped" },
  { id: asOrderId("PWN-10240"), customerLabel: "M. Klein", total: 2330, placedAt: "2026-06-28", items: [item("contour-jacket", 1250), item("draped-hoodie", 480), item("silk-structure-shirt", 620)], displayStatus: "Processing" },
  { id: asOrderId("PWN-10239"), customerLabel: "L. Marchetti", total: 480, placedAt: "2026-06-27", items: [item("draped-hoodie", 480)], displayStatus: "Delivered" },
  { id: asOrderId("PWN-10238"), customerLabel: "S. Iqbal", total: 1870, placedAt: "2026-06-27", items: [item("contour-jacket", 1250), item("wire-bag", 620, "One Size")], displayStatus: "Delivered" },
  { id: asOrderId("PWN-10237"), customerLabel: "K. Tanaka", total: 620, placedAt: "2026-06-26", items: [item("silk-structure-shirt", 620)], displayStatus: "Returned" },
];

export const seedCustomerOrders = [
  { id: "PWN-10212", date: "2026-06-18", total: 1450, status: "In transit", items: [{ name: "Asymmetric Coat", designer: "Y/PROJECT" }] },
  { id: "PWN-10184", date: "2026-05-30", total: 480, status: "Delivered", items: [{ name: "Draped Hoodie", designer: "LEMAIRE" }] },
  { id: "PWN-10122", date: "2026-04-12", total: 1510, status: "Delivered", items: [{ name: "Contour Jacket", designer: "1017 ALYX 9SM" }, { name: "Wire Bag", designer: "TOTEME" }] },
];

export const seedRevenueSeries = [12, 18, 16, 24, 28, 22, 31, 36, 33, 41, 47, 52];
export const seedMonthsShort = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
