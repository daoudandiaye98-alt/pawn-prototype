// Teil 38 AP7 — Preisumbau: der Server-seitige Zwilling von src/lib/planGate.ts. Nach außen gibt
// es nur noch zwei Pläne (Frei/Paid); die DB behält 'haus'/'atelier'/'maison' für bestehende
// Atelier-Abos, die ihren alten Preis weiterlaufen lassen. 'atelier' wird nicht mehr neu vergeben —
// jede neue Paid-Anmeldung läuft über PAID_PLAN_KEY.
export type Plan = "haus" | "atelier" | "maison";

export const PAID_PLAN_KEY: Plan = "maison";

export function isPaidPlan(plan: Plan): boolean {
  return plan !== "haus";
}
