import type { Designer } from "../types/entities";

export const seedDesigners: Designer[] = [];

export function designerIdBySlug(slug: string) {
  return seedDesigners.find((d) => d.slug === slug)?.id;
}
