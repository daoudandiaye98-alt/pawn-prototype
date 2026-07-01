import type { Product, ProductCategory, ProductGender, StyleGenome } from "../types/entities";
import { asBrandId, asProductId } from "../types/ids";
import { designerIdBySlug } from "./designers";

interface RawProduct {
  slug: string; name: string; designerSlug: string; price: number;
  category: ProductCategory; gender: ProductGender;
  colors: string[]; sizes: string[]; status: "Active" | "Inactive"; description: string;
  affinity: Partial<StyleGenome>;
}

const raw: RawProduct[] = [
  { slug: "asymmetric-coat", name: "Asymmetric Coat", designerSlug: "y-project", price: 1450, category: "Outerwear", gender: "Unisex", colors: ["Ink", "Bone"], sizes: ["XS","S","M","L"], status: "Active", description: "A sculptural double-breasted coat built around an off-center seam. Tailored from heavy Italian wool with raw inner edges.", affinity: { structure: 0.9, darkness: 0.6, edge: 0.5 } },
  { slug: "draped-hoodie", name: "Draped Hoodie", designerSlug: "lemaire", price: 480, category: "Tops", gender: "Unisex", colors: ["Ash", "Sand"], sizes: ["S","M","L","XL"], status: "Active", description: "Oversized hoodie with a gravity-cut shoulder and brushed cotton interior.", affinity: { elegance: 0.7, utility: 0.6, structure: 0.4 } },
  { slug: "silk-structure-shirt", name: "Silk Structure Shirt", designerSlug: "rick-owens", price: 620, category: "Tops", gender: "Women", colors: ["Obsidian"], sizes: ["XS","S","M"], status: "Active", description: "Bias-cut silk shirt with architectural shoulder line and concealed placket.", affinity: { structure: 0.7, sensuality: 0.7, darkness: 0.8 } },
  { slug: "contour-jacket", name: "Contour Jacket", designerSlug: "alyx", price: 1250, category: "Outerwear", gender: "Men", colors: ["Onyx"], sizes: ["S","M","L"], status: "Active", description: "Industrial-weight jacket finished with the signature rollercoaster hardware.", affinity: { edge: 0.9, utility: 0.7, darkness: 0.7 } },
  { slug: "double-waist-jeans", name: "Double Waist Jeans", designerSlug: "y-project", price: 630, category: "Bottoms", gender: "Unisex", colors: ["Raw Indigo"], sizes: ["28","30","32","34"], status: "Active", description: "Signature double-waistband jean in selvedge denim.", affinity: { edge: 0.7, structure: 0.6 } },
  { slug: "wire-bag", name: "Wire Bag", designerSlug: "toteme", price: 890, category: "Bags", gender: "Women", colors: ["Bone", "Cognac"], sizes: ["One Size"], status: "Inactive", description: "Sculpted leather bag with hand-formed wire frame and detachable strap.", affinity: { elegance: 0.8, structure: 0.6 } },
];

export const seedProducts: Product[] = raw.map((r, i) => ({
  id: asProductId(`prd_${(i + 1).toString().padStart(3, "0")}`),
  slug: r.slug,
  name: r.name,
  designerId: designerIdBySlug(r.designerSlug),
  brandId: asBrandId(`brand_${r.designerSlug}`),
  price: r.price,
  category: r.category,
  gender: r.gender,
  colors: r.colors,
  sizes: r.sizes,
  status: r.status,
  description: r.description,
  genomeAffinity: r.affinity,
}));

export function productIdBySlug(slug: string) {
  return seedProducts.find((p) => p.slug === slug)?.id ?? seedProducts[0].id;
}
