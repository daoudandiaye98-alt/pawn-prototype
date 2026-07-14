import type { Product, ProductCategory, ProductGender, StyleGenome, World } from "../types/entities";
import { asBrandId, asProductId } from "../types/ids";
import { designerIdBySlug } from "./designers";

interface RawProduct {
  slug: string; name: string; designerSlug: string; price: number;
  category: ProductCategory; gender: ProductGender; world: World;
  colors: string[]; sizes: string[]; status: "Active" | "Inactive"; description: string;
  affinity: Partial<StyleGenome>;
}

const raw: RawProduct[] = [];
 
export const seedProducts: Product[] = raw.map((r, i) => ({
  id: asProductId(`prd_${(i + 1).toString().padStart(3, "0")}`),
  slug: r.slug,
  name: r.name,
  designerId: designerIdBySlug(r.designerSlug),
  brandId: asBrandId(`brand_${r.designerSlug}`),
  price: r.price,
  category: r.category,
  gender: r.gender,
  world: r.world,
  colors: r.colors,
  sizes: r.sizes,
  status: r.status,
  description: r.description,
  genomeAffinity: r.affinity,
}));

export function productIdBySlug(slug: string) {
  return seedProducts.find((p) => p.slug === slug)?.id;
}
