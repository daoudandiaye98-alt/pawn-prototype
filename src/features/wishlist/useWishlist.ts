import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export function useWishlist() {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) { setIds(new Set()); return; }
    setLoading(true);
    const { data } = await supabase.from("wishlists").select("product_id").eq("user_id", user.id);
    setIds(new Set((data ?? []).map((r) => r.product_id)));
    setLoading(false);
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  const has = useCallback((productId: string) => ids.has(productId), [ids]);

  const toggle = useCallback(async (productId: string) => {
    if (!user) { toast.error("Bitte anmelden, um zu merken."); return; }
    if (ids.has(productId)) {
      await supabase.from("wishlists").delete().eq("user_id", user.id).eq("product_id", productId);
      setIds((prev) => { const n = new Set(prev); n.delete(productId); return n; });
    } else {
      await supabase.from("wishlists").insert({ user_id: user.id, product_id: productId });
      setIds((prev) => new Set(prev).add(productId));
      toast.success("Gemerkt.");
    }
  }, [ids, user]);

  return { has, toggle, ids, loading, refresh };
}
