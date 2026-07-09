import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Plan = "haus" | "atelier" | "maison";

export interface PlanLimits {
  haus: { videos_per_month: number; tier: number };
  atelier: { videos_per_month: number; tier: number };
  maison: { videos_per_month: number; tier: number };
}

const DEFAULT_LIMITS: PlanLimits = {
  haus:    { videos_per_month: 2,  tier: 1 },
  atelier: { videos_per_month: 10, tier: 2 },
  maison:  { videos_per_month: 30, tier: 3 },
};

export interface QuotaStatus {
  plan: Plan;
  used: number;
  limit: number;
  remaining: number;
  atLimit: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useCampaignQuota(designerId?: string | null, plan: Plan = "haus"): QuotaStatus {
  const [limits, setLimits] = useState<PlanLimits>(DEFAULT_LIMITS);
  const [used, setUsed] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!designerId) { setLoading(false); return; }
    setLoading(true);
    const [{ data: cfg }, { count }] = await Promise.all([
      supabase.from("ai_config").select("value").eq("key", "plan_limits").maybeSingle(),
      (() => {
        const monthStart = new Date();
        monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
        return supabase.from("campaigns")
          .select("id", { count: "exact", head: true })
          .eq("designer_id", designerId)
          .eq("kind", "video")
          .gte("created_at", monthStart.toISOString());
      })(),
    ]);
    if (cfg?.value) setLimits({ ...DEFAULT_LIMITS, ...(cfg.value as unknown as PlanLimits) });
    setUsed(count ?? 0);
    setLoading(false);
  };

  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [designerId]);

  const limit = limits[plan]?.videos_per_month ?? DEFAULT_LIMITS[plan].videos_per_month;
  const remaining = Math.max(0, limit - used);
  return { plan, used, limit, remaining, atLimit: remaining === 0, loading, refresh };
}

export function planLabel(plan: Plan): string {
  return plan === "haus" ? "Haus" : plan === "atelier" ? "Atelier" : "Maison";
}
