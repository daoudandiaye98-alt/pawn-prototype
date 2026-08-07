import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PublicDesigner {
  id: string;
  slug: string;
  brand_name: string;
  location: string | null;
  country: string | null;
  story: string | null;
  quote: string | null;
  quote_role: string | null;
  is_featured: boolean;
  hero_image_url: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  tags: string[] | null;
  house_number: number | null;
  created_at?: string | null;
}

/**
 * Seed fallback so the palace is never empty — kuratiert, konsistent zur Story.
 * Reihenfolge = Bühnenreihenfolge.
 */
/**
 * Bewusst leer: PAWN zeigt nie erfundene Häuser oder fremde Marken.
 * Solange keine echten Häuser eingezogen sind, bleibt die Bühne ehrlich leer.
 */
export const SEED_DESIGNERS: PublicDesigner[] = [];

async function loadShowSeedFlag(): Promise<boolean> {
  try {
    const { data } = await supabase.from("site_content").select("value").eq("key", "show_seed_content").maybeSingle();
    if (!data) return true;
    const v = data.value;
    return typeof v === "boolean" ? v : true;
  } catch { return true; }
}

export function usePublicDesigners() {
  const [designers, setDesigners] = useState<PublicDesigner[]>(SEED_DESIGNERS);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [showSeed, resp] = await Promise.all([
        loadShowSeedFlag(),
        supabase
          .from("designers")
          .select("id, slug, brand_name, location, country, story, quote, quote_role, is_featured, hero_image_url, avatar_url, banner_url, tags, house_number, created_at")
          .eq("status", "active")
          .order("is_featured", { ascending: false })
          .limit(60),
      ]);
      if (cancelled) return;
      const { data, error } = resp;
      const dbList = !error && data ? (data as PublicDesigner[]) : [];
      if (!showSeed) {
        setDesigners(dbList);
      } else {
        const bySlug = new Map<string, PublicDesigner>();
        for (const s of SEED_DESIGNERS) bySlug.set(s.slug, s);
        for (const d of dbList) bySlug.set(d.slug, d);
        setDesigners(Array.from(bySlug.values()));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);
  return { designers, loading };
}


export interface PublicCollection {
  id: string;
  number: number;
  title: string;
  subtitle: string | null;
  items: { product_slug: string; world: string | null; sort: number }[];
}

const SEED_COLLECTION: PublicCollection = {
  id: "seed-col", number: 0, title: "", subtitle: null, items: [],
};

export function useActiveCollection() {
  const [collection, setCollection] = useState<PublicCollection>(SEED_COLLECTION);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: cols } = await supabase
        .from("curated_collections")
        .select("id, number, title, subtitle")
        .eq("is_active", true)
        .order("number", { ascending: false })
        .limit(1);
      if (cancelled || !cols || cols.length === 0) return;
      const col = cols[0];
      const { data: items } = await supabase
        .from("collection_items")
        .select("product_slug, world, sort")
        .eq("collection_id", col.id)
        .order("sort");
      if (cancelled) return;
      if (items && items.length > 0) {
        setCollection({ ...col, items } as PublicCollection);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return collection;
}

/** Published DB products, keyed by world for the world pages / Neu grid. */
export interface PublicProduct {
  id: string;
  slug: string;
  name: string;
  world: "Mode" | "Interior" | "Kunst";
  price: number;
  image_url: string | null;
  designer_id: string;
}

export function usePublishedProducts(world?: "Mode" | "Interior" | "Kunst") {
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let q = supabase
        .from("products")
        .select("id, slug, name, world, price, image_url, designer_id")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(60);
      if (world) q = q.eq("world", world);
      const { data } = await q;
      if (cancelled) return;
      setProducts((data ?? []) as PublicProduct[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [world]);
  return { products, loading };
}

