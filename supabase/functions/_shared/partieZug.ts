// Teil 28c — Das Partie-Buch: ein Zug ist eine einzelne Zeile in der Chronik eines Hauses.
// Schreiber: pawn-chat (Onboarding), pawn-jarvis (Automatik), stripe-webhook (Verkäufe).
// Die Nummerierung ist best effort (count+1, kein Lock) — ein seltener doppelter Zählerstand
// ist für eine kosmetische Zugnummer unkritisch und darf den eigentlichen Vorgang nie blockieren.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type PartieAkteur = "haus" | "pawn" | "halle";

export async function schreibePartieZug(
  admin: SupabaseClient,
  designerId: string,
  text: string,
  akteur: PartieAkteur,
  quelle?: string,
): Promise<void> {
  try {
    const { count } = await admin.from("partie_zuege").select("id", { count: "exact", head: true }).eq("designer_id", designerId);
    await admin.from("partie_zuege").insert({
      designer_id: designerId, nr: (count ?? 0) + 1, text, akteur, quelle: quelle ?? null,
    });
  } catch { /* das Partie-Buch darf nie einen echten Vorgang blockieren */ }
}
