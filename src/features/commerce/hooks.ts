import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Database } from "@/integrations/supabase/types";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];

/**
 * Client-side stock guard: fetches inventory info for cart product slugs
 * and returns available max qty. Made-to-order returns Infinity.
 */
export function useCartStockLimits(slugs: string[]) {
  const [limits, setLimits] = useState<Record<string, number>>({});
  useEffect(() => {
    if (slugs.length === 0) { setLimits({}); return; }
    let alive = true;
    (async () => {
      const { data } = await supabase.from("products")
        .select("slug, inventory_mode, stock_quantity")
        .in("slug", slugs);
      const map: Record<string, number> = {};
      for (const p of (data ?? []) as Pick<ProductRow, "slug" | "inventory_mode" | "stock_quantity">[]) {
        map[p.slug] = p.inventory_mode === "made_to_order" ? Number.POSITIVE_INFINITY : (p.stock_quantity ?? 0);
      }
      if (alive) setLimits(map);
    })();
    return () => { alive = false; };
  }, [slugs.join("|")]);
  return limits;
}

/**
 * Threads-with-details hook that also exposes product info.
 */
export interface ThreadWithProduct {
  id: string;
  designer_id: string;
  created_by: string;
  subject: string;
  category: string;
  status: string;
  last_message_at: string;
  product_id: string | null;
  product?: { slug: string; name: string } | null;
  designer?: { slug: string; brand_name: string } | null;
}

export function useMyRequestThreads() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<ThreadWithProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setThreads([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from("message_threads")
      .select("id, designer_id, created_by, subject, category, status, last_message_at, product_id, products:product_id(slug, name), designers:designer_id(slug, brand_name)")
      .eq("created_by", user.id)
      .order("last_message_at", { ascending: false });
    setThreads(((data ?? []) as unknown as (ThreadWithProduct & { products?: { slug: string; name: string } | null; designers?: { slug: string; brand_name: string } | null })[])
      .map((t) => ({ ...t, product: t.products ?? null, designer: t.designers ?? null })));
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  return { threads, loading, refresh: load };
}
