import type { Designer } from "../types/entities";
import { asBrandId, asDesignerId } from "../types/ids";

interface RawDesigner {
  slug: string; name: string; location: string; slogan: string; bio: string;
  followers: number; collections: number; productsCount: number; memberSince: string; featuredIn: number;
}

const raw: RawDesigner[] = [
  { slug: "y-project", name: "Y/PROJECT", location: "Paris, France", slogan: "Architecture of the asymmetric.", bio: "A Paris-based studio building garments around the tension between tailoring and deconstruction. Each season is a continuation of a single conversation about how clothing holds the body.", followers: 184200, collections: 12, productsCount: 86, memberSince: "2021", featuredIn: 14 },
  { slug: "lemaire", name: "LEMAIRE", location: "Paris, France", slogan: "Quiet luxury, drawn slowly.", bio: "Studio of restrained line and patient material. Garments designed to age into the wearer.", followers: 132000, collections: 9, productsCount: 64, memberSince: "2022", featuredIn: 9 },
  { slug: "rick-owens", name: "Rick Owens", location: "Paris, France", slogan: "Glamour in the ruins.", bio: "An ongoing study of brutalist romance.", followers: 421000, collections: 24, productsCount: 142, memberSince: "2020", featuredIn: 22 },
  { slug: "alyx", name: "1017 ALYX 9SM", location: "Milan, Italy", slogan: "Hardware as language.", bio: "Industrial precision applied to ready-to-wear.", followers: 198000, collections: 11, productsCount: 72, memberSince: "2021", featuredIn: 12 },
  { slug: "toteme", name: "TOTEME", location: "Stockholm, Sweden", slogan: "Wardrobe as architecture.", bio: "Considered essentials, made to be returned to.", followers: 256000, collections: 14, productsCount: 98, memberSince: "2022", featuredIn: 10 },
];

export const seedDesigners: Designer[] = raw.map((r) => ({
  id: asDesignerId(`des_${r.slug}`),
  brandIds: [asBrandId(`brand_${r.slug}`)],
  ...r,
}));

export function designerIdBySlug(slug: string) {
  return seedDesigners.find((d) => d.slug === slug)?.id ?? seedDesigners[0].id;
}
