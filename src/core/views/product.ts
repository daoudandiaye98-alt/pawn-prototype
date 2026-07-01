// Denormalized view models — the shape UI components consume.
//
// The domain layer stores normalized entities. Views join them for display so
// pages stay dumb and never traverse relationships themselves.

import type { Designer, Order, Product } from "../types/entities";

export interface ProductView {
  id: string;
  slug: string;
  name: string;
  designer: string;
  designerSlug: string;
  price: number;
  category: Product["category"];
  gender: Product["gender"];
  colors: string[];
  sizes: string[];
  status: Product["status"];
  description: string;
}

export interface DesignerView {
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

export interface OrderView {
  id: string;
  customer: string;
  total: number;
  status: Order["status"];
  date: string;
  items: number;
}

export function toProductView(product: Product, designer: Designer | undefined): ProductView {
  return {
    id: product.id as string,
    slug: product.slug,
    name: product.name,
    designer: designer?.name ?? "",
    designerSlug: designer?.slug ?? "",
    price: product.price,
    category: product.category,
    gender: product.gender,
    colors: product.colors,
    sizes: product.sizes,
    status: product.status,
    description: product.description,
  };
}

export function toDesignerView(designer: Designer): DesignerView {
  return {
    slug: designer.slug,
    name: designer.name,
    location: designer.location,
    slogan: designer.slogan,
    bio: designer.bio,
    followers: designer.followers,
    collections: designer.collections,
    productsCount: designer.productsCount,
    memberSince: designer.memberSince,
    featuredIn: designer.featuredIn,
  };
}

export function toOrderView(order: Order): OrderView {
  return {
    id: order.id as string,
    customer: order.customerLabel,
    total: order.total,
    status: order.status,
    date: order.placedAt,
    items: order.items.reduce((sum, it) => sum + it.qty, 0),
  };
}
