import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Teil 33 — Die zweite Kartei: Markenbauen. Zeigt die aktiven, freigegebenen Thesen aus
 * `brand_knowledge` (gespeist vom pawn-jarvis-Modus wissen_markenaufbau) im Cockpit.
 */

export interface MarkenKarteiThese {
  id: string;
  headline: string;
  body: string;
  world: string | null;
  quelleTyp: string;
  gueltigkeitsvermutung: string | null;
  ageDays: number;
}

export function useMarkenKartei(refreshKey: number | string = 0) {
  const [theses, setTheses] = useState<MarkenKarteiThese[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data } = await supabase.from("brand_knowledge" as never)
      .select("id, headline, body, world, quelle_typ, gueltigkeitsvermutung, created_at")
      .eq("approved", true).eq("active", true)
      .order("created_at", { ascending: false })
      .limit(12);
    const rows = (data ?? []) as unknown as {
      id: string; headline: string; body: string; world: string | null;
      quelle_typ: string; gueltigkeitsvermutung: string | null; created_at: string;
    }[];
    setTheses(rows.map((r) => ({
      id: r.id, headline: r.headline, body: r.body, world: r.world,
      quelleTyp: r.quelle_typ, gueltigkeitsvermutung: r.gueltigkeitsvermutung,
      ageDays: Math.max(0, Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86_400_000)),
    })));
    setLoading(false);
  }, []);

  useEffect(() => { void reload(); }, [reload, refreshKey]);

  const verwerfen = useCallback(async (id: string) => {
    setTheses((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("brand_knowledge" as never).update({ active: false } as never).eq("id", id);
  }, []);

  return { theses, loading, verwerfen };
}
