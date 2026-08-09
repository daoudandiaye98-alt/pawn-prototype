// AP5 — zentraler Budget-Guard: eine Stelle für "ist ein Haus über dem KI-Budget für diesen
// Monat?", statt verstreuter Ad-hoc-Vorprüfungen in einzelnen Jarvis-Modi. Gilt nur für Jarvis-
// initiiertes Hintergrund-Spending pro Haus (z.B. tueren_finden, maison_sichtbarkeitszug) — NICHT
// für kundenseitig ausgelöste Erzeugung (generate-tryon, generate-product-shot, generate-broll):
// dort bleiben die sichtbaren Plan-Kontingente das durchsetzende Limit, das interne KI-Budget ist
// dort bewusst nur informativ (siehe CLAUDE.md, Teil 6b) und blockiert nie einen bezahlten Kauf.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

interface BookAiSpendResult {
  spent_cents?: number;
  limit_cents?: number;
  over_budget?: boolean;
}

/** Reine Prüfung ohne zu buchen (0-Cent-Anfrage an die bestehende book_ai_spend-Funktion). */
export async function checkAiBudget(
  admin: SupabaseClient, designerId: string,
): Promise<{ overBudget: boolean; spentCents: number; limitCents: number }> {
  const { data } = await admin.rpc("book_ai_spend", { _designer_id: designerId, _cents: 0 });
  const r = (data ?? {}) as BookAiSpendResult;
  return { overBudget: !!r.over_budget, spentCents: r.spent_cents ?? 0, limitCents: r.limit_cents ?? 0 };
}

/** Bucht Ist-Kosten (Cent) in den Ledger. Rein informativ — schlägt nie fehl nach außen. */
export async function bookAiSpend(admin: SupabaseClient, designerId: string, cents: number): Promise<void> {
  if (!(cents > 0)) return;
  try { await admin.rpc("book_ai_spend", { _designer_id: designerId, _cents: cents }); } catch { /* informativ, blockiert nie */ }
}

/**
 * Guard für Jarvis-Hintergrundläufe: prüft das Budget eines Hauses; bei Überschreitung ein
 * sauberer Skip (kein Fehler, kein Retry-Sturm) mit einer jarvis_notices-Zeile als Spur. Gibt
 * zurück, ob der Lauf für dieses Haus fortgesetzt werden darf.
 */
export async function guardAiBudget(
  admin: SupabaseClient, designerId: string, houseName: string, noticeKind: string, skipReason: string,
): Promise<boolean> {
  const check = await checkAiBudget(admin, designerId);
  if (!check.overBudget) return true;
  try {
    await admin.from("jarvis_notices").insert({
      kind: noticeKind,
      title: `Übersprungen: ${houseName}`,
      body: `${houseName} hat das monatliche KI-Budget bereits ausgeschöpft (${check.spentCents}/${check.limitCents} Cent) — ${skipReason}`,
    });
  } catch { /* Meldung ist informativ, blockiert nie den Skip selbst */ }
  return false;
}
