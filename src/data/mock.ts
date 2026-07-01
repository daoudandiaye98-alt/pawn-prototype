// Compat shim: the legacy denormalized shape pages rely on, now derived from
// src/core/seed. Do not add new fields here — new consumers should read core
// selectors directly. This file will be removed once all pages are migrated.

import {
  seedDesigners, seedProducts, seedAdminOrders, seedCustomerOrders,
  seedRevenueSeries, seedMonthsShort, seedDnaSegments, seedColorTrends,
} from "@/core/seed";

export interface Product {
  id: string;
  slug: string;
  name: string;
  designer: string;
  designerSlug: string;
  price: number;
  category: "Outerwear" | "Tops" | "Bottoms" | "Bags" | "Accessories";
  gender: "Women" | "Men" | "Unisex";
  colors: string[];
  sizes: string[];
  status: "Active" | "Inactive";
  description: string;
}

export interface Designer {
  slug: string;
  name: string;
  location: string;
  slogan: string;
  bio: string;
  followers: number;
  collections: number;
  productsCount: number;
  memberSince: string;
  featuredIn: number;
}

export interface Order {
  id: string;
  customer: string;
  total: number;
  status: "Processing" | "Shipped" | "Delivered" | "Returned";
  date: string;
  items: number;
}

const designerNameById = new Map(seedDesigners.map((d) => [d.id as string, d.name]));
const designerSlugById = new Map(seedDesigners.map((d) => [d.id as string, d.slug]));

export const products: Product[] = seedProducts.map((p) => ({
  id: p.id as string,
  slug: p.slug,
  name: p.name,
  designer: designerNameById.get(p.designerId as string) ?? "",
  designerSlug: designerSlugById.get(p.designerId as string) ?? "",
  price: p.price,
  category: p.category,
  gender: p.gender,
  colors: p.colors,
  sizes: p.sizes,
  status: p.status,
  description: p.description,
}));

export const productBySlug = (slug: string) =>
  products.find((p) => p.slug === slug) ?? products[0];

export const designers: Designer[] = seedDesigners.map((d) => ({
  slug: d.slug,
  name: d.name,
  location: d.location,
  slogan: d.slogan,
  bio: d.bio,
  followers: d.followers,
  collections: d.collections,
  productsCount: d.productsCount,
  memberSince: d.memberSince,
  featuredIn: d.featuredIn,
}));

export const designerBySlug = (slug: string) =>
  designers.find((d) => d.slug === slug) ?? designers[0];

export const adminOrders: Order[] = seedAdminOrders.map((o) => ({
  id: o.id as string,
  customer: o.customerLabel,
  total: o.total,
  status: o.displayStatus,
  date: o.placedAt,
  items: o.items.reduce((sum, it) => sum + it.qty, 0),
}));

export const customerOrders = seedCustomerOrders;
export const revenueSeries = seedRevenueSeries;
export const monthsShort = seedMonthsShort;
export const dnaSegments = seedDnaSegments;
export const colorTrends = seedColorTrends;
