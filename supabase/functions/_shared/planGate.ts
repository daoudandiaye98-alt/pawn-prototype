// PART 48 — "Eine Wahrheit für Pläne". Server-seitiger Zwilling von src/lib/planGate.ts. Liest
// ai_config.plans (Feld "plaene"), hardcodet keine Grenzen — nur die TYP-Zuordnung je Funktion
// (monat/bestand/schalter) ist Code. checkAndCount ist die einzige Stelle, die zugleich prüft
// UND zählt (RPC plan_usage_inkrement, atomar).
//
// Abweichung von der ursprünglichen Auftragsvorlage (siehe PR): 'video'/'tryon' stehen NICHT in
// limits — sie bleiben über die bestehende Credits-Kasse (credits_ledger/book_credit_spend,
// Teil 11a) geregelt; deren Monatsguthaben kommt jetzt aus plaene.<plan>.credits_per_month.
//
// Rang ist nie käuflich: diese Datei kennt nur Plan → Funktion, nie Plan → Rang.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { checkAiBudget } from "./budgetGuard.ts";

export type Plan = "haus" | "atelier" | "maison";
export const PLAN_REIHE: Plan[] = ["haus", "atelier", "maison"];

export type GrenzTyp = "monat" | "bestand" | "schalter";

export interface Grenze {
  typ: GrenzTyp;
  wert: number; // -1 = unbegrenzt
}

export interface PlanConfig {
  label: string;
  eur_month: number;
  stripe_price_id: string | null;
  model_tier: string;
  budget_cents_month: number;
  credits_per_month: number;
  limits: Record<string, number>;
}

const FEATURE_TYPEN: Record<string, GrenzTyp> = {
  tuer_oeffnen: "monat",
  chat_nachricht: "monat",
  produkte: "bestand",
  welten: "bestand",
  signature_previews: "monat",
  chat_retrieval: "schalter",
  director_loop: "schalter",
  dashboard_metriken: "schalter",
  sichtbarkeitszug: "schalter",
  mini_pawn: "schalter",
  marken_kartei: "schalter",
  tuer_vorlauf: "schalter",
  emblem: "schalter",
};

const FALLBACK_PLAENE: Record<Plan, PlanConfig> = {
  haus: {
    label: "Haus", eur_month: 0, stripe_price_id: null, model_tier: "standard",
    budget_cents_month: 0, credits_per_month: 30,
    limits: {
      tuer_oeffnen: 1, chat_nachricht: 30, produkte: -1, welten: 1, signature_previews: 1,
      chat_retrieval: 0, director_loop: 0, dashboard_metriken: 0, sichtbarkeitszug: 0,
      mini_pawn: 0, marken_kartei: 0, tuer_vorlauf: 0, emblem: 1,
    },
  },
  atelier: {
    label: "Atelier", eur_month: 19, stripe_price_id: null, model_tier: "plus",
    budget_cents_month: 700, credits_per_month: 300,
    limits: {
      tuer_oeffnen: 8, chat_nachricht: 300, produkte: -1, welten: 1, signature_previews: 3,
      chat_retrieval: 1, director_loop: 0, dashboard_metriken: 1, sichtbarkeitszug: 0,
      mini_pawn: 0, marken_kartei: 0, tuer_vorlauf: 0, emblem: 0,
    },
  },
  maison: {
    label: "Maison", eur_month: 79, stripe_price_id: null, model_tier: "max",
    budget_cents_month: 3000, credits_per_month: 1200,
    limits: {
      tuer_oeffnen: -1, chat_nachricht: 1000, produkte: -1, welten: 3, signature_previews: -1,
      chat_retrieval: 1, director_loop: 1, dashboard_metriken: 1, sichtbarkeitszug: 1,
      mini_pawn: 1, marken_kartei: 1, tuer_vorlauf: 1, emblem: 0,
    },
  },
};

const FALLBACK_MODEL_TIERS: Record<string, string> = { standard: "gpt-4o-mini", plus: "gpt-4o", max: "gpt-4o" };

function isValidPlaene(v: unknown): v is Record<Plan, PlanConfig> {
  if (!v || typeof v !== "object") return false;
  return PLAN_REIHE.every((p) => {
    const row = (v as Record<string, unknown>)[p];
    return !!row && typeof row === "object" && typeof (row as PlanConfig).limits === "object";
  });
}

/** Lädt frisch pro Aufruf (Edge Functions sind kurzlebig) — mit typisiertem, geloggtem Fallback. */
export async function ladePlaene(admin: SupabaseClient): Promise<Record<Plan, PlanConfig>> {
  const { data } = await admin.from("ai_config").select("value").eq("key", "plans").maybeSingle();
  const raw = data?.value as { plaene?: unknown } | null;
  if (raw?.plaene && isValidPlaene(raw.plaene)) return raw.plaene;
  console.error("[planGate] ai_config.plans fehlt oder hat ein unerwartetes Schema — Fallback aktiv.");
  return FALLBACK_PLAENE;
}

async function ladeModelTiers(admin: SupabaseClient): Promise<Record<string, string>> {
  const { data } = await admin.from("ai_config").select("value").eq("key", "model_tiers").maybeSingle();
  const tiers = data?.value as Record<string, string> | null;
  return tiers && typeof tiers === "object" ? tiers : FALLBACK_MODEL_TIERS;
}

export function typFor(feature: string): GrenzTyp {
  return FEATURE_TYPEN[feature] ?? "schalter";
}

export function limitFor(plaene: Record<Plan, PlanConfig>, plan: Plan, feature: string): number {
  const wert = plaene[plan]?.limits[feature];
  if (wert === undefined) {
    console.error(`[planGate] Unbekanntes Feature "${feature}" — als gesperrt behandelt.`);
    return 0;
  }
  return wert;
}

export function canUse(plaene: Record<Plan, PlanConfig>, plan: Plan, feature: string): boolean {
  return limitFor(plaene, plan, feature) !== 0;
}

export function minPlanFor(plaene: Record<Plan, PlanConfig>, feature: string): Plan | null {
  return PLAN_REIHE.find((p) => canUse(plaene, p, feature)) ?? null;
}

export function preisFor(plaene: Record<Plan, PlanConfig>, plan: Plan): number {
  return plaene[plan]?.eur_month ?? 0;
}

export function stripePriceFor(plaene: Record<Plan, PlanConfig>, plan: Plan): string | null {
  return plaene[plan]?.stripe_price_id ?? null;
}

/** Jeder Plan außer Haus ist ein Bezahlplan. */
export function isPaidPlan(plan: Plan): boolean {
  return plan !== "haus";
}

export interface GateErgebnis {
  erlaubt: boolean;
  grund?: "plan" | "kontingent" | "budget";
  stand: number;
  limit: number;
  plan: Plan;
  minPlan: Plan | null;
  degradiert?: boolean;
  modell: string;
}

/**
 * Prüft UND zählt in einem Schritt. `aktuellerStand` ist für 'bestand'-Grenzen Pflicht (die
 * Fachtabelle — z.B. Produkte, Welten — kennt der Aufrufer selbst; planGate zählt keine fremden
 * Tabellen, um nicht implizit Wissen über jede Fachtabelle vorauszusetzen).
 */
export async function checkAndCount(
  supabase: SupabaseClient,
  designerId: string,
  feature: string,
  opts: { aktuellerStand?: number } = {},
): Promise<GateErgebnis> {
  const { data: designerRow } = await supabase.from("designers").select("plan").eq("id", designerId).maybeSingle();
  const plan = ((designerRow as { plan?: Plan } | null)?.plan ?? "haus") as Plan;

  const plaene = await ladePlaene(supabase);
  const minPlan = minPlanFor(plaene, feature);
  const modelTiers = await ladeModelTiers(supabase);
  let modell = modelTiers[plaene[plan]?.model_tier ?? "standard"] ?? FALLBACK_MODEL_TIERS.standard;

  if (!canUse(plaene, plan, feature)) {
    return { erlaubt: false, grund: "plan", stand: 0, limit: 0, plan, minPlan, modell };
  }

  const typ = typFor(feature);
  const limit = limitFor(plaene, plan, feature);

  if (typ === "schalter") {
    return { erlaubt: true, stand: 1, limit, plan, minPlan, modell };
  }

  if (typ === "bestand") {
    const stand = opts.aktuellerStand ?? 0;
    const erlaubt = limit < 0 || stand < limit;
    return { erlaubt, grund: erlaubt ? undefined : "kontingent", stand, limit, plan, minPlan, modell };
  }

  // typ === "monat" — Degradieren statt blockieren: ist das interne Cent-Budget erreicht, aber
  // der Plan hat noch Kontingent, läuft die Anfrage mit dem Standard-Modell weiter statt
  // abzubrechen. Bei 'haus' (Budget 0) gilt das nicht — dort ist 'standard' ohnehin voreingestellt.
  let degradiert = false;
  if (isPaidPlan(plan)) {
    const budgetCheck = await checkAiBudget(supabase, designerId);
    if (budgetCheck.overBudget) {
      degradiert = true;
      modell = modelTiers.standard ?? FALLBACK_MODEL_TIERS.standard;
    }
  }

  const { data: rpcData } = await supabase.rpc("plan_usage_inkrement", {
    p_designer_id: designerId, p_feature: feature, p_limit: limit,
  });
  const row = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as
    { erlaubt?: boolean; stand?: number; limit_wert?: number } | null;
  const erlaubt = !!row?.erlaubt;

  return {
    erlaubt,
    grund: erlaubt ? undefined : "kontingent",
    stand: row?.stand ?? 0,
    limit: row?.limit_wert ?? limit,
    plan, minPlan,
    degradiert: degradiert || undefined,
    modell,
  };
}
