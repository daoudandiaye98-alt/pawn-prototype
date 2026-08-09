import type { Plan } from "@/features/campaign/quota";

/**
 * Teil 38 AP7 — Preisumbau: nach außen gibt es nur noch zwei Pläne, Frei und Paid. Die
 * Datenbank behält weiterhin drei Werte (haus/atelier/maison), weil bestehende Atelier-Abos
 * ihren alten Stripe-Preis weiterlaufen lassen — Atelier wird nur nicht mehr neu vergeben.
 * Dieses Modul ist die einzige Stelle, die "Frei vs. Paid" entscheidet, statt das an jeder
 * Gate-Stelle einzeln mit `plan === "haus"` nachzubauen.
 */
export type PlanTier = "frei" | "paid";

/** Der Konfigurationsschlüssel, über den jede neue Paid-Anmeldung läuft
 * (ai_config.plan_prices.maison, ai_config.plan_limits.maison, Checkout-price_id). */
export const PAID_PLAN_KEY: Plan = "maison";

export function planTier(plan: Plan): PlanTier {
  return plan === "haus" ? "frei" : "paid";
}

export function isPaidPlan(plan: Plan): boolean {
  return planTier(plan) === "paid";
}

/** Ein Bestandsabo im alten mittleren Plan — zahlt weiter seinen bisherigen Preis, aber Atelier
 * lässt sich nicht mehr neu abschließen. Nur für ehrliche Anzeige, keine Einschränkung. */
export function isLegacyPlan(plan: Plan): boolean {
  return plan === "atelier";
}
