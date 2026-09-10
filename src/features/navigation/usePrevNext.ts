import { useStore, marketplaceSelectors } from "@/core";

interface Link { to: string; label: string }

/** Walk products inside the same world; falls back to full catalog. */
export function useProductPrevNext(currentSlug: string): { prev: Link | null; next: Link | null } {
  const items = useStore(marketplaceSelectors.getAllProductViews);
  const current = items.find((p) => p.slug === currentSlug);
  const list = current ? items.filter((p) => p.world === current.world) : items;
  const idx = list.findIndex((p) => p.slug === currentSlug);
  if (idx === -1) return { prev: null, next: null };
  const p = idx > 0 ? list[idx - 1] : null;
  const n = idx < list.length - 1 ? list[idx + 1] : null;
  return {
    prev: p ? { to: `/werk/${p.slug}`, label: p.name } : null,
    next: n ? { to: `/werk/${n.slug}`, label: n.name } : null,
  };
}

/** Walk designers alphabetically by name. */
export function useDesignerPrevNext(currentSlug: string): { prev: Link | null; next: Link | null } {
  const items = useStore(marketplaceSelectors.getAllDesignerViews);
  const list = [...items].sort((a, b) => a.name.localeCompare(b.name));
  const idx = list.findIndex((d) => d.slug === currentSlug);
  if (idx === -1) return { prev: null, next: null };
  const p = idx > 0 ? list[idx - 1] : null;
  const n = idx < list.length - 1 ? list[idx + 1] : null;
  return {
    prev: p ? { to: `/haus/${p.slug}`, label: p.name } : null,
    next: n ? { to: `/haus/${n.slug}`, label: n.name } : null,
  };
}
