import type { Product, ProductCategory, ProductGender, StyleGenome, World } from "../types/entities";
import { asBrandId, asProductId } from "../types/ids";
import { designerIdBySlug } from "./designers";

interface RawProduct {
  slug: string; name: string; designerSlug: string; price: number;
  category: ProductCategory; gender: ProductGender; world: World;
  colors: string[]; sizes: string[]; status: "Active" | "Inactive"; description: string;
  affinity: Partial<StyleGenome>;
}

const raw: RawProduct[] = [
  // ─── Mode ────────────────────────────────────────────────
  { slug: "asymmetric-coat", name: "Asymmetric Coat", designerSlug: "y-project", price: 1450, category: "Outerwear", gender: "Unisex", world: "Mode", colors: ["Ink", "Bone"], sizes: ["XS","S","M","L"], status: "Active", description: "A sculptural double-breasted coat built around an off-center seam. Tailored from heavy Italian wool with raw inner edges.", affinity: { structure: 0.9, darkness: 0.6, edge: 0.5 } },
  { slug: "draped-hoodie", name: "Draped Hoodie", designerSlug: "lemaire", price: 480, category: "Tops", gender: "Unisex", world: "Mode", colors: ["Ash", "Sand"], sizes: ["S","M","L","XL"], status: "Active", description: "Oversized hoodie with a gravity-cut shoulder and brushed cotton interior.", affinity: { elegance: 0.7, utility: 0.6, structure: 0.4 } },
  { slug: "silk-structure-shirt", name: "Silk Structure Shirt", designerSlug: "rick-owens", price: 620, category: "Tops", gender: "Women", world: "Mode", colors: ["Obsidian"], sizes: ["XS","S","M"], status: "Active", description: "Bias-cut silk shirt with architectural shoulder line and concealed placket.", affinity: { structure: 0.7, sensuality: 0.7, darkness: 0.8 } },
  { slug: "contour-jacket", name: "Contour Jacket", designerSlug: "alyx", price: 1250, category: "Outerwear", gender: "Men", world: "Mode", colors: ["Onyx"], sizes: ["S","M","L"], status: "Active", description: "Industrial-weight jacket finished with the signature rollercoaster hardware.", affinity: { edge: 0.9, utility: 0.7, darkness: 0.7 } },
  { slug: "double-waist-jeans", name: "Double Waist Jeans", designerSlug: "y-project", price: 630, category: "Bottoms", gender: "Unisex", world: "Mode", colors: ["Raw Indigo"], sizes: ["28","30","32","34"], status: "Active", description: "Signature double-waistband jean in selvedge denim.", affinity: { edge: 0.7, structure: 0.6 } },
  { slug: "wire-bag", name: "Wire Bag", designerSlug: "toteme", price: 890, category: "Bags", gender: "Women", world: "Mode", colors: ["Bone", "Cognac"], sizes: ["One Size"], status: "Active", description: "Sculpted leather bag with hand-formed wire frame and detachable strap.", affinity: { elegance: 0.8, structure: 0.6 } },

  // ─── Interior · Studio Oyu ───────────────────────────────
  { slug: "oyu-lantern", name: "Lantern N°04", designerSlug: "studio-oyu", price: 2100, category: "Lighting", gender: "Unisex", world: "Interior", colors: ["Rice Paper"], sizes: ["One Size"], status: "Active", description: "Handformed paper shade over a brushed-brass frame. Diffuses a warm, low glow.", affinity: { elegance: 0.8, structure: 0.6 } },
  { slug: "oyu-bench", name: "Bench 002", designerSlug: "studio-oyu", price: 3400, category: "Furniture", gender: "Unisex", world: "Interior", colors: ["Charred Oak"], sizes: ["180cm"], status: "Active", description: "A single beam of shou-sugi-ban oak on three tapered legs. Waxed by hand.", affinity: { structure: 0.9, darkness: 0.7 } },
  { slug: "oyu-halo-mirror", name: "Halo Mirror", designerSlug: "studio-oyu", price: 1250, category: "Mirror", gender: "Unisex", world: "Interior", colors: ["Antique Silver"], sizes: ["Ø70cm"], status: "Active", description: "A circle of hand-silvered glass in a whisper-thin steel frame.", affinity: { elegance: 0.7, structure: 0.5 } },
  { slug: "oyu-vessel-v", name: "Vessel V", designerSlug: "studio-oyu", price: 480, category: "Vase", gender: "Unisex", world: "Interior", colors: ["Ash Glaze"], sizes: ["32cm"], status: "Active", description: "Wheel-thrown stoneware vase, high-fired, matte ash glaze.", affinity: { elegance: 0.6, structure: 0.5 } },

  // ─── Kunst · Kaja Solgaard & Atelier Noor ────────────────
  { slug: "kaja-sediment-i", name: "Sediment I", designerSlug: "kaja-solgaard", price: 8200, category: "Painting", gender: "Unisex", world: "Kunst", colors: ["Ochre / Ash"], sizes: ["120×160cm"], status: "Active", description: "Oil and pigment on raw linen. A geological layer, seen from above.", affinity: { elegance: 0.6, darkness: 0.5 } },
  { slug: "kaja-sediment-ii", name: "Sediment II", designerSlug: "kaja-solgaard", price: 7600, category: "Painting", gender: "Unisex", world: "Kunst", colors: ["Bone / Ink"], sizes: ["100×140cm"], status: "Active", description: "Companion work to Sediment I. Longer horizon, quieter palette.", affinity: { elegance: 0.6, darkness: 0.4 } },
  { slug: "kaja-edition-14", name: "Edition N°14", designerSlug: "kaja-solgaard", price: 1450, category: "Edition", gender: "Unisex", world: "Kunst", colors: ["Photogravure"], sizes: ["50×70cm"], status: "Active", description: "Signed and numbered photogravure, edition of 24, on Hahnemühle rag.", affinity: { elegance: 0.7 } },
  { slug: "noor-warp-study", name: "Warp Study", designerSlug: "atelier-noor", price: 5400, category: "Tapestry", gender: "Unisex", world: "Kunst", colors: ["Sand / Iron"], sizes: ["160×220cm"], status: "Active", description: "Hand-woven wall tapestry. Undyed wool, iron-mordant weft, three months at the loom.", affinity: { structure: 0.7, elegance: 0.6 } },
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
  world: r.world,
  colors: r.colors,
  sizes: r.sizes,
  status: r.status,
  description: r.description,
  genomeAffinity: r.affinity,
}));

export function productIdBySlug(slug: string) {
  return seedProducts.find((p) => p.slug === slug)?.id ?? seedProducts[0].id;
}
