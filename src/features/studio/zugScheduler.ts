import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useVerkaufsbereitschaft } from "./useVerkaufsbereitschaft";
import type { VerkaufsCheck } from "@/features/commerce/verkaufsbereit";

/**
 * Teil K3 (Abschnitt 3) — der Prioritäts-Scheduler des Bauern: aus allem, was im Haus
 * ansteht, wird GENAU EINE sichtbare Zug-Karte. Die Reihenfolge ist fest:
 * 0. Eröffnung (unvollendeter /start) → 1. Verträge → 2. Verkaufsfertig (drei Häkchen
 * in EINEM Zug, kein Dauerbanner) → 3. Freigaben → 4. Tür der Woche → 5. Rückblick
 * (wöchentlich) → 6. Idee. Alles weitere zeigt "Alle Züge ansehen".
 */

export type ZugKey =
  | "eroeffnung" | "vertraege" | "verkaufsfertig" | "freigabe" | "tuer" | "rueckblick" | "idee";

export interface Zug {
  key: ZugKey;
  to: string;
  /** Nur beim Verkaufsfertig-Zug: die drei Häkchen (Zahlungen/Rechnungsdaten/Versand). */
  checks?: VerkaufsCheck[];
}

function isoWeek(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${week}`;
}

export function rueckblickGesehen(designerId: string): boolean {
  try { return localStorage.getItem(`pawn_rueckblick_${designerId}`) === isoWeek(); } catch { return false; }
}
export function rueckblickAbhaken(designerId: string) {
  try { localStorage.setItem(`pawn_rueckblick_${designerId}`, isoWeek()); } catch { /* noop */ }
}

export function useZugScheduler(args: {
  designerId?: string;
  hatWartendeKampagne: boolean;
  neueTueren: number;
}): { zuege: Zug[]; aktueller: Zug | null; loading: boolean } {
  const { user } = useAuth();
  const verkauf = useVerkaufsbereitschaft();
  const [offeneVertraege, setOffeneVertraege] = useState<number | null>(null);
  const [offenerStart, setOffenerStart] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      // Verträge: aktuell gültige Fassungen ohne (nicht widerrufene) Zustimmung — dieselbe
      // Wahrheit wie das frühere ContractV2Banner, jetzt als Zug statt Dauerbanner.
      const { data: contracts } = await supabase
        .from("contract_versions").select("id").is("effective_to", null);
      const ids = ((contracts as { id: string }[] | null) ?? []).map((c) => c.id);
      let missing = 0;
      if (ids.length) {
        const { data: consents } = await supabase
          .from("designer_consents").select("contract_version_id")
          .eq("user_id", user.id).is("revoked_at", null).in("contract_version_id", ids);
        const accepted = new Set(((consents as { contract_version_id: string }[] | null) ?? []).map((c) => c.contract_version_id));
        missing = ids.filter((id) => !accepted.has(id)).length;
      }
      if (alive) setOffeneVertraege(missing);

      // "Deine Eröffnung wartet" — nur bei unvollendetem /start (Sitzung existiert noch).
      const { data: fm } = await supabase
        .from("first_move_sessions" as never).select("user_id").eq("user_id", user.id).maybeSingle();
      if (alive) setOffenerStart(!!fm);
    })();
    return () => { alive = false; };
  }, [user]);

  const zuege = useMemo<Zug[]>(() => {
    const list: Zug[] = [];
    if (offenerStart) list.push({ key: "eroeffnung", to: "/start" });
    if ((offeneVertraege ?? 0) > 0) list.push({ key: "vertraege", to: "/studio/vertraege" });
    if (!verkauf.loading && !verkauf.bereit) list.push({ key: "verkaufsfertig", to: verkauf.offen[0]?.to ?? "/studio/auszahlung", checks: verkauf.checks });
    if (args.hatWartendeKampagne) list.push({ key: "freigabe", to: "/studio/clips" });
    if (args.neueTueren > 0) list.push({ key: "tuer", to: "/studio/tueren" });
    if (args.designerId && !rueckblickGesehen(args.designerId)) list.push({ key: "rueckblick", to: "/studio/copilot" });
    list.push({ key: "idee", to: "/studio/content-begleiter" });
    return list;
  }, [offenerStart, offeneVertraege, verkauf.loading, verkauf.bereit, verkauf.offen, verkauf.checks, args.hatWartendeKampagne, args.neueTueren, args.designerId]);

  const loading = offeneVertraege === null || offenerStart === null || verkauf.loading;
  return { zuege, aktueller: zuege[0] ?? null, loading };
}
