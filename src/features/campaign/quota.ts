import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Plan = "haus" | "atelier" | "maison";

/** Was jede Handlung kostet — editierbar unter /admin/ki, nichts hart im Code. */
export interface CreditCosts {
  product_shot?: number;
  tryon_shot?: number;
  tryon_clip?: number;
  clip_standard?: number;
  clip_premium?: number;
  [key: string]: number | undefined;
}

const DEFAULT_CREDIT_COSTS: CreditCosts = {
  product_shot: 1, tryon_shot: 2, tryon_clip: 8, clip_standard: 5, clip_premium: 12,
};

const DEFAULT_PLAN_CREDITS: Record<Plan, number> = { haus: 30, atelier: 300, maison: 1200 };

export interface CreditStatus {
  plan: Plan;
  balance: number;
  grant: number;
  consumed: number;
  loading: boolean;
  unlimited: boolean;
  costs: CreditCosts;
  refresh: () => Promise<void>;
  /** Reicht das aktuelle Guthaben für eine Handlung mit diesen Kosten? Admins sind immer unbegrenzt. */
  canAfford: (cost: number) => boolean;
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function useCredits(designerId?: string | null, plan: Plan = "haus", isAdmin = false): CreditStatus {
  const [balance, setBalance] = useState(0);
  const [grant, setGrant] = useState(DEFAULT_PLAN_CREDITS[plan] ?? 0);
  const [consumed, setConsumed] = useState(0);
  const [costs, setCosts] = useState<CreditCosts>(DEFAULT_CREDIT_COSTS);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!designerId) { setLoading(false); return; }
    setLoading(true);
    const month = currentMonth();
    const [{ data: ledger }, { data: planCreditsCfg }, { data: costsCfg }] = await Promise.all([
      supabase.from("credits_ledger" as never).select("balance, consumed").eq("designer_id", designerId).eq("month", month).maybeSingle(),
      supabase.from("ai_config").select("value").eq("key", "plan_credits").maybeSingle(),
      supabase.from("ai_config").select("value").eq("key", "credit_costs").maybeSingle(),
    ]);
    const planGrants = { ...DEFAULT_PLAN_CREDITS, ...((planCreditsCfg?.value as Partial<Record<Plan, number>>) ?? {}) };
    const thisGrant = planGrants[plan] ?? 0;
    setGrant(thisGrant);
    const row = ledger as unknown as { balance?: number; consumed?: number } | null;
    setBalance(row ? (row.balance ?? 0) : thisGrant);
    setConsumed(row?.consumed ?? 0);
    if (costsCfg?.value) setCosts({ ...DEFAULT_CREDIT_COSTS, ...(costsCfg.value as CreditCosts) });
    setLoading(false);
  };

  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [designerId, plan]);

  return {
    plan, balance, grant, consumed, loading,
    unlimited: isAdmin,
    costs,
    refresh,
    canAfford: (cost: number) => isAdmin || balance >= cost,
  };
}

export function planLabel(plan: Plan): string {
  return plan === "haus" ? "Haus" : plan === "atelier" ? "Atelier" : "Maison";
}

/** "300 Credits ≈ 25 Freisteller + 8 Clips" — grobe, ehrliche Beispielrechnung für die Plan-Seite. */
export function creditExample(credits: number, costs: CreditCosts): string {
  const shotCost = costs.product_shot ?? 1;
  const clipCost = costs.clip_standard ?? 5;
  if (credits <= 0) return "";
  const shots = Math.floor((credits * 0.6) / shotCost);
  const remaining = credits - shots * shotCost;
  const clips = Math.floor(remaining / clipCost);
  const parts = [shots > 0 ? `${shots} Freisteller` : null, clips > 0 ? `${clips} Clips` : null].filter(Boolean);
  return parts.length ? `${credits} Credits ≈ ${parts.join(" + ")}` : `${credits} Credits`;
}
