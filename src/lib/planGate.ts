import type { Plan } from "@/features/campaign/quota";

/**
 * PART 38 WP7: PAWN hat wieder drei kaufbare Pläne — Haus (0 €), Atelier, Maison, jeder mit
 * eigenem Preis und eigenen Limits (siehe ai_config.plan_prices/plan_limits, quota.ts). Die
 * frühere Frei/Paid-Vereinfachung (Teil 38 AP7) ist auf Wunsch zurückgenommen: Atelier ist kein
 * auslaufendes Bestandsabo mehr, sondern wieder ein regulärer, neu abschließbarer Plan.
 */
export function isPaidPlan(plan: Plan): boolean {
  return plan !== "haus";
}
