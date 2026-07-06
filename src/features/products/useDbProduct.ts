import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type DbProduct = Database["public"]["Tables"]["products"]["Row"] & {
  designers?: { id: string; slug: string; brand_name: string; user_id: string } | null;
};

export function useDbProductBySlug(slug: string | undefined) {
  const [product, setProduct] = useState<DbProduct | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!slug) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("*, designers ( id, slug, brand_name, user_id )")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();
      if (!alive) return;
      setProduct((data as DbProduct | null) ?? null);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [slug]);

  return { product, loading };
}
