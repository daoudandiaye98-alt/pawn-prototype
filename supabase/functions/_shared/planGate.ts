// PART 38 WP7: Server-seitiger Zwilling von src/lib/planGate.ts. PAWN hat wieder drei kaufbare
// Pläne — Haus (0 €), Atelier, Maison. Die frühere Frei/Paid-Vereinfachung (Teil 38 AP7) ist auf
// Wunsch zurückgenommen: Atelier ist wieder ein regulärer, neu abschließbarer Plan.
export type Plan = "haus" | "atelier" | "maison";

export function isPaidPlan(plan: Plan): boolean {
  return plan !== "haus";
}
