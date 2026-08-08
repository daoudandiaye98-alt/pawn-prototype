// Teil 28c — Signalstrom: ein Muster, kein Rohtext. Siehe Migration pawn_signals für die Regel.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export async function schreibeSignal(
  admin: SupabaseClient,
  quelle: string,
  kind: string,
  pattern: Record<string, unknown>,
  world?: string | null,
): Promise<void> {
  try {
    await admin.from("pawn_signals").insert({ quelle, kind, pattern, world: world ?? null });
  } catch { /* Signalstrom darf nie einen echten Vorgang blockieren */ }
}
