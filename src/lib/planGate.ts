/**
 * PART 48 — "Eine Wahrheit für Pläne". Eine Stelle, an der steht, was ein Plan kostet und was er
 * erlaubt: ai_config.plans (Schlüssel "plans", Feld "plaene"). planGate liest diese Konfiguration,
 * es hardcodet keine Grenzen — nur die TYP-Zuordnung je Funktion (monat/bestand/schalter) ist
 * Code, weil sie beschreibt, WIE eine Zahl zu lesen ist, nicht WELCHE Zahl gilt.
 *
 * Die vier alten Schlüssel plan_prices/plan_limits/plan_credits/ai_budget_limits sind hier
 * zusammengeführt. Abweichung von der ursprünglichen Auftragsvorlage (siehe PR-Beschreibung):
 * 'video'/'tryon' stehen NICHT in limits — sie bleiben über die bestehende Credits-Kasse
 * (credits_ledger/book_credit_spend, Teil 11a) geregelt, deren Monatsguthaben jetzt aus
 * plaene.<plan>.credits_per_month kommt statt aus dem separaten Schlüssel plan_credits.
 *
 * Rang ist nie käuflich: diese Datei kennt nur Plan → Funktion, nie Plan → Rang (Bauer/Läufer/
 * Turm/Dame kommen ausschließlich aus designer_level, siehe supabase/migrations/…-designer_level).
 */
import { supabase } from "@/integrations/supabase/client";

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

/** WIE eine Zahl aus limits zu lesen ist — nicht WELCHE Zahl gilt (die kommt aus der Konfiguration). */
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

/** Nur falls ai_config.plans fehlt oder das Schema nicht passt — dieser Fall wird geloggt. */
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

let plaeneCache: Record<Plan, PlanConfig> = FALLBACK_PLAENE;
let modelTiersCache: Record<string, string> = FALLBACK_MODEL_TIERS;
let ladePromise: Promise<void> | null = null;

/** Lädt ai_config.plans + ai_config.model_tiers einmal; danach lesen alle Funktionen den Cache. */
export function ladePlanGate(): Promise<void> {
  if (!ladePromise) {
    ladePromise = Promise.all([
      supabase.from("ai_config").select("value").eq("key", "plans").maybeSingle(),
      supabase.from("ai_config").select("value").eq("key", "model_tiers").maybeSingle(),
    ]).then(([plansRes, tiersRes]) => {
      const raw = plansRes.data?.value as { plaene?: unknown } | null;
      if (raw?.plaene && isValidPlaene(raw.plaene)) {
        plaeneCache = raw.plaene;
      } else {
        console.error("[planGate] ai_config.plans fehlt oder hat ein unerwartetes Schema — Fallback aktiv.");
      }
      const tiers = tiersRes.data?.value as Record<string, string> | null;
      if (tiers && typeof tiers === "object") {
        modelTiersCache = tiers;
      }
    }).catch((e) => {
      console.error("[planGate] Konnte ai_config.plans nicht laden — Fallback aktiv.", e);
    });
  }
  return ladePromise;
}

function planConfig(plan: Plan): PlanConfig {
  return plaeneCache[plan] ?? FALLBACK_PLAENE[plan];
}

export function limitFor(plan: Plan, feature: string): number {
  const wert = planConfig(plan).limits[feature];
  if (wert === undefined) {
    console.error(`[planGate] Unbekanntes Feature "${feature}" — als gesperrt behandelt.`);
    return 0;
  }
  return wert;
}

export function typFor(feature: string): GrenzTyp {
  return FEATURE_TYPEN[feature] ?? "schalter";
}

export function canUse(plan: Plan, feature: string): boolean {
  return limitFor(plan, feature) !== 0;
}

export function minPlanFor(feature: string): Plan | null {
  return PLAN_REIHE.find((p) => canUse(p, feature)) ?? null;
}

export function preisFor(plan: Plan): number {
  return planConfig(plan).eur_month;
}

export function stripePriceFor(plan: Plan): string | null {
  return planConfig(plan).stripe_price_id;
}

export function planLabel(plan: Plan): string {
  return planConfig(plan).label;
}

export function creditsPerMonth(plan: Plan): number {
  return planConfig(plan).credits_per_month;
}

export function modelFor(plan: Plan): string {
  const tier = planConfig(plan).model_tier;
  return modelTiersCache[tier] ?? FALLBACK_MODEL_TIERS.standard;
}

/** Jeder Plan außer Haus ist ein Bezahlplan — für Kündigungsseite/Nachricht-Wechsel-Logik. */
export function isPaidPlan(plan: Plan): boolean {
  return plan !== "haus";
}

/**
 * "welten" ist eine Bestand-Grenze auf die Zahl VERSCHIEDENER Welten (Mode/Interior/Kunst), in
 * denen ein Haus Stücke führt — nicht auf die Stückzahl. Ein Stück in einer bereits genutzten
 * Welt ist immer erlaubt; eine bisher ungenutzte Welt nur, solange das Kontingent reicht.
 */
export function weltenErlaubt(plan: Plan, bestehendeWelten: string[], neueWelt: string): boolean {
  if (bestehendeWelten.includes(neueWelt)) return true;
  const limit = limitFor(plan, "welten");
  return limit < 0 || bestehendeWelten.length < limit;
}

/** Nächsthöherer Plan, der mehr Welten gleichzeitig erlaubt als der aktuelle — für den Hinweistext. */
export function naechsterPlanFuerMehrWelten(plan: Plan): Plan | null {
  const aktuelles = limitFor(plan, "welten");
  const idx = PLAN_REIHE.indexOf(plan);
  for (let i = idx + 1; i < PLAN_REIHE.length; i++) {
    const l = limitFor(PLAN_REIHE[i], "welten");
    if (l < 0 || l > aktuelles) return PLAN_REIHE[i];
  }
  return null;
}
