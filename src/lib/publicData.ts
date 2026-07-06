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
}

/**
 * Seed fallback so the palace is never empty — kuratiert, konsistent zur Story.
 * Reihenfolge = Bühnenreihenfolge.
 */
export const SEED_DESIGNERS: PublicDesigner[] = [
  {
    id: "seed-1", slug: "y-project", brand_name: "Y/PROJECT", location: "Paris", country: "FR",
    story: "Ein Atelier, das Kleidung um die Spannung zwischen Schnitt und Dekonstruktion baut.",
    quote: "Kleidung darf einen Widerspruch tragen — genau da beginnt sie zu leben.",
    quote_role: "Glenn Martens, Kreativdirektion",
    is_featured: true, hero_image_url: null, avatar_url: null, banner_url: null, tags: ["Mode"],
  },
  {
    id: "seed-2", slug: "lemaire", brand_name: "LEMAIRE", location: "Paris", country: "FR",
    story: "Ruhiger Luxus, langsam gezeichnet. Kleidung, die in ihre Träger:in hineinwächst.",
    quote: "Wir zeichnen, was bleibt. Der Rest ist Rauschen.",
    quote_role: "Christophe Lemaire",
    is_featured: true, hero_image_url: null, avatar_url: null, banner_url: null, tags: ["Mode"],
  },
  {
    id: "seed-3", slug: "rick-owens", brand_name: "Rick Owens", location: "Paris", country: "FR",
    story: "Ein fortlaufendes Studium brutalistischer Romantik.", quote: null, quote_role: null,
    is_featured: true, hero_image_url: null, avatar_url: null, banner_url: null, tags: ["Mode"],
  },
  {
    id: "seed-4", slug: "alyx", brand_name: "1017 ALYX 9SM", location: "Milano", country: "IT",
    story: "Industrielle Präzision, in Ready-to-wear übersetzt.", quote: null, quote_role: null,
    is_featured: true, hero_image_url: null, avatar_url: null, banner_url: null, tags: ["Mode"],
  },
  {
    id: "seed-5", slug: "toteme", brand_name: "TOTEME", location: "Stockholm", country: "SE",
    story: "Essenzen, zu denen man zurückkehrt.", quote: null, quote_role: null,
    is_featured: true, hero_image_url: null, avatar_url: null, banner_url: null, tags: ["Mode"],
  },
  {
    id: "seed-6", slug: "studio-oyu", brand_name: "Studio Oyu", location: "Rotterdam", country: "NL",
    story: "Objekte an der Schwelle zwischen Möbel und Skulptur.", quote: null, quote_role: null,
    is_featured: true, hero_image_url: null, avatar_url: null, banner_url: null, tags: ["Interior"],
  },
  {
    id: "seed-7", slug: "kaja-solgaard", brand_name: "Kaja Solgaard", location: "Oslo", country: "NO",
    story: "Malerei als geologische Zeitschicht.", quote: null, quote_role: null,
    is_featured: true, hero_image_url: null, avatar_url: null, banner_url: null, tags: ["Kunst"],
  },
  {
    id: "seed-8", slug: "atelier-noor", brand_name: "Atelier Noor", location: "Antwerpen", country: "BE",
    story: "Handwerkliche Textilarbeit an der Grenze zum Objekt.", quote: null, quote_role: null,
    is_featured: true, hero_image_url: null, avatar_url: null, banner_url: null, tags: ["Mode"],
  },
];

export function usePublicDesigners() {
  const [designers, setDesigners] = useState<PublicDesigner[]>(SEED_DESIGNERS);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("designers")
        .select("id, slug, brand_name, location, country, story, quote, quote_role, is_featured, hero_image_url, avatar_url, banner_url, tags")
        .eq("status", "active")
        .order("is_featured", { ascending: false })
        .limit(40);
      if (cancelled) return;
      if (!error && data && data.length > 0) {
        // Merge: DB wins on slug, seeds fill gaps
        const bySlug = new Map<string, PublicDesigner>();
        for (const s of SEED_DESIGNERS) bySlug.set(s.slug, s);
        for (const d of data as PublicDesigner[]) bySlug.set(d.slug, d);
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
  id: "seed-col", number: 12,
  title: "Stille Kontraste",
  subtitle: "Zwölf Stücke, drei Welten.",
  items: [
    { product_slug: "asymmetric-coat", world: "Mode", sort: 0 },
    { product_slug: "silk-structure-shirt", world: "Mode", sort: 1 },
    { product_slug: "oyu-bench", world: "Interior", sort: 2 },
    { product_slug: "kaja-sediment-i", world: "Kunst", sort: 3 },
    { product_slug: "draped-hoodie", world: "Mode", sort: 4 },
    { product_slug: "oyu-lantern", world: "Interior", sort: 5 },
    { product_slug: "noor-warp-study", world: "Kunst", sort: 6 },
    { product_slug: "contour-jacket", world: "Mode", sort: 7 },
    { product_slug: "oyu-halo-mirror", world: "Interior", sort: 8 },
    { product_slug: "kaja-sediment-ii", world: "Kunst", sort: 9 },
    { product_slug: "oyu-vessel-v", world: "Interior", sort: 10 },
    { product_slug: "kaja-edition-14", world: "Kunst", sort: 11 },
  ],
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

