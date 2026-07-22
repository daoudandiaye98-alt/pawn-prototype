import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Plan = "haus" | "atelier" | "maison";

interface PlanEntry {
  videos_per_month: number;
  kinematic_videos_per_month: number;
  emblem: boolean;
  signature_previews: number;
  tryon_shots_per_month: number;
  product_shots_per_month: number;
  tier: number;
}
export interface PlanLimits {
  haus: PlanEntry;
  atelier: PlanEntry;
  maison: PlanEntry;
  accent_cost_units?: number;
  unlimited_plans?: Plan[];
}

const DEFAULT_LIMITS: PlanLimits = {
  haus:    { videos_per_month: 3,  kinematic_videos_per_month: 0,  emblem: true,  signature_previews: 1, tryon_shots_per_month: 5,  product_shots_per_month: 5,  tier: 1 },
  atelier: { videos_per_month: 15, kinematic_videos_per_month: 8,  emblem: false, signature_previews: 3, tryon_shots_per_month: 25, product_shots_per_month: 25, tier: 2 },
  maison:  { videos_per_month: 40, kinematic_videos_per_month: 40, emblem: false, signature_previews: -1, tryon_shots_per_month: -1, product_shots_per_month: -1, tier: 3 },
  accent_cost_units: 2,
  unlimited_plans: ["maison"],
};

export interface QuotaStatus {
  plan: Plan;
  used: number;
  limit: number;
  remaining: number;
  atLimit: boolean;
  loading: boolean;
  unlimited: boolean;
  accentCostUnits: number;
  /** Kinematischer Modus: Kontingent + Verbrauch diesen Monat (aus video_assets.video_dna.cinematic). */
  kinematicUsed: number;
  kinematicLimit: number;
  kinematicAllowed: boolean;
  kinematicAtLimit: boolean;
  limits: PlanLimits;
  refresh: () => Promise<void>;
}

function monthStartIso(): string {
  const d = new Date();
  d.setDate(1); d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function useCampaignQuota(designerId?: string | null, plan: Plan = "haus", isAdmin = false): QuotaStatus {
  const [limits, setLimits] = useState<PlanLimits>(DEFAULT_LIMITS);
  const [used, setUsed] = useState(0);
  const [kinematicUsed, setKinematicUsed] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!designerId) { setLoading(false); return; }
    setLoading(true);
    const since = monthStartIso();
    const [{ data: cfg }, { count }, { data: videos }] = await Promise.all([
      supabase.from("ai_config").select("value").eq("key", "plan_limits").maybeSingle(),
      supabase.from("campaigns")
        .select("id", { count: "exact", head: true })
        .eq("designer_id", designerId)
        .eq("kind", "video")
        .gte("created_at", since),
      supabase.from("video_assets" as never)
        .select("video_dna")
        .eq("designer_id", designerId)
        .gte("created_at", since),
    ]);
    if (cfg?.value) setLimits({ ...DEFAULT_LIMITS, ...(cfg.value as unknown as PlanLimits) });
    setUsed(count ?? 0);
    const cinematicCount = ((videos ?? []) as unknown as Array<{ video_dna: { cinematic?: boolean } | null }>)
      .filter((v) => v.video_dna?.cinematic === true).length;
    setKinematicUsed(cinematicCount);
    setLoading(false);
  };

  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [designerId]);

  const unlimited = isAdmin || (limits.unlimited_plans ?? []).includes(plan);
  const limit = unlimited ? Infinity : (limits[plan]?.videos_per_month ?? DEFAULT_LIMITS[plan].videos_per_month);
  const remaining = unlimited ? Infinity : Math.max(0, limit - used);

  const kinematicLimitRaw = limits[plan]?.kinematic_videos_per_month ?? DEFAULT_LIMITS[plan].kinematic_videos_per_month;
  const kinematicLimit = unlimited || kinematicLimitRaw < 0 ? Infinity : kinematicLimitRaw;
  const kinematicAtLimit = !isAdmin && kinematicLimit !== Infinity && kinematicUsed >= kinematicLimit;

  return {
    plan, used, limit, remaining,
    atLimit: !unlimited && remaining === 0,
    loading, unlimited,
    accentCostUnits: limits.accent_cost_units ?? 2,
    kinematicUsed, kinematicLimit,
    kinematicAllowed: kinematicLimit > 0,
    kinematicAtLimit,
    limits,
    refresh,
  };
}

export function planLabel(plan: Plan): string {
  return plan === "haus" ? "Haus" : plan === "atelier" ? "Atelier" : "Maison";
}
