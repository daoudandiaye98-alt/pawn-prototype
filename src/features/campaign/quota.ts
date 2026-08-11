import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ladePlanGate, limitFor, canUse } from "@/lib/planGate";

export type Plan = "haus" | "atelier" | "maison";

/**
 * Was ein Haus pro Monat bekommt — in echten Dingen, nicht in Punkten. -1 = unbegrenzt.
 * videos/cinematic/shots sind grobe, feste Anhaltswerte (die eigentliche Grenze ist das
 * gemeinsame Guthaben aus dem Credits-System, Teil 11a — verschiedene Aktionen kosten
 * unterschiedlich viel, ein einzelner fester "Videos"-Zähler kann das nur annähern).
 * signature_previews/emblem kommen live aus ai_config.plans (planGate).
 */
export interface PlanQuota {
  videos: number;
  cinematic: number;
  shots: number;
  signature_previews: number;
  emblem: boolean;
  tier: number;
}

export type QuotaKind = "videos" | "cinematic" | "shots";

export const DEFAULT_PLAN_QUOTAS: Record<Plan, PlanQuota> = {
  haus: { videos: 3, cinematic: 0, shots: 5, signature_previews: 1, emblem: true, tier: 1 },
  atelier: { videos: 15, cinematic: 8, shots: 25, signature_previews: 3, emblem: false, tier: 2 },
  maison: { videos: 40, cinematic: 40, shots: -1, signature_previews: -1, emblem: false, tier: 3 },
};

export interface QuotaStatus {
  plan: Plan;
  loading: boolean;
  /** Admins und unbegrenzte Stufen kennen keine Grenze. */
  unlimited: boolean;
  limits: PlanQuota;
  used: Record<QuotaKind, number>;
  /** Verbleibende Einheiten; -1 bedeutet unbegrenzt. */
  left: (kind: QuotaKind) => number;
  canDo: (kind: QuotaKind) => boolean;
  /** "2 von 3 Videos · 4 von 5 Shots" — eine ruhige Zeile statt Guthabenstand. */
  summary: string;
  refresh: () => Promise<void>;
}

interface LedgerHistoryItem { at: string; action: string; credits: number }

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function isCinematicAction(action: string): boolean {
  return action.startsWith("clip");
}

function isShotAction(action: string): boolean {
  return action === "product_shot" || action === "tryon_shot" || action === "staging_shot";
}

export function formatQuota(used: number, limit: number, noun: string): string {
  if (limit < 0) return `unbegrenzt ${noun}`;
  return `${Math.min(used, limit)} von ${limit} ${noun}`;
}

/**
 * Monats-Limite statt Guthaben: was der Designer sieht, sind Videos und Shots,
 * keine Punkte. videos/cinematic/shots bleiben feste Anhaltswerte (DEFAULT_PLAN_QUOTAS,
 * die eigentliche Grenze ist die Credits-Kasse); signature_previews/emblem kommen live aus
 * ai_config.plans (planGate). Verbrauch aus dem, was wirklich entstanden ist (video_assets)
 * bzw. serverseitig gebucht wurde.
 */
export function usePlanQuota(designerId?: string | null, plan: Plan = "haus", isAdmin = false): QuotaStatus {
  const [limits, setLimits] = useState<PlanQuota>(DEFAULT_PLAN_QUOTAS[plan]);
  const [used, setUsed] = useState<Record<QuotaKind, number>>({ videos: 0, cinematic: 0, shots: 0 });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!designerId) { setLoading(false); return; }
    setLoading(true);
    const month = currentMonth();
    const monthStart = `${month}-01T00:00:00.000Z`;

    const [, { data: ledger }, { count: videoCount }] = await Promise.all([
      ladePlanGate(),
      supabase.from("credits_ledger" as never).select("history").eq("designer_id", designerId).eq("month", month).maybeSingle(),
      supabase.from("video_assets" as never)
        .select("id", { count: "exact", head: true })
        .eq("designer_id", designerId)
        .gte("created_at", monthStart),
    ]);

    setLimits({
      ...DEFAULT_PLAN_QUOTAS[plan],
      signature_previews: limitFor(plan, "signature_previews"),
      emblem: canUse(plan, "emblem"),
    });

    const history = ((ledger as unknown as { history?: LedgerHistoryItem[] } | null)?.history ?? [])
      .filter((h) => h.credits < 0);
    setUsed({
      videos: videoCount ?? 0,
      cinematic: history.filter((h) => isCinematicAction(h.action)).length,
      shots: history.filter((h) => isShotAction(h.action)).length,
    });
    setLoading(false);
  }, [designerId, plan]);

  useEffect(() => { void refresh(); }, [refresh]);

  const left = (kind: QuotaKind): number => {
    const limit = limits[kind];
    if (isAdmin || limit < 0) return -1;
    return Math.max(0, limit - used[kind]);
  };

  return {
    plan,
    loading,
    unlimited: isAdmin,
    limits,
    used,
    left,
    canDo: (kind) => isAdmin || limits[kind] < 0 || used[kind] < limits[kind],
    summary: `${formatQuota(used.videos, isAdmin ? -1 : limits.videos, "Videos")} · ${formatQuota(used.shots, isAdmin ? -1 : limits.shots, "Shots")}`,
    refresh,
  };
}

export function planLabel(plan: Plan): string {
  return plan === "haus" ? "Haus" : plan === "atelier" ? "Atelier" : "Maison";
}

/** Sanfter Hinweis, wenn ein Limit endet — kein Dauerbanner. PART 38 WP7: PAWN hat wieder drei
 * kaufbare Pläne, der Hinweis nennt daher den jeweils nächsthöheren statt pauschal "Paid". */
export function quotaExhaustedHint(plan: Plan, noun: string): string {
  if (plan === "maison") {
    return `Dein Limit an ${noun} für diesen Monat ist aufgebraucht — am 1. ist es wieder da.`;
  }
  const next = plan === "haus" ? "Atelier oder Maison" : "Maison";
  return `Dein Limit an ${noun} für diesen Monat ist aufgebraucht — am 1. ist es wieder da, oder wechsle in den Plan ${next}.`;
}
