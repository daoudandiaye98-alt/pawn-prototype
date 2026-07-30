import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * Teil 20 (Vorlauf): zählt Besuche + Verweildauer je eingeloggtem Nutzer für eine
 * Haus- oder Produktseite (page_visits) — die Grundlage für Belege wie „3 Mal
 * zurückgekehrt“ oder „38 Sekunden angesehen“ im Stilberater/Außenauge/Analyse.
 * Anonymes Stöbern bleibt ungezählt, genau wie beim übrigen Geschmacksprofil.
 */
export function usePageVisit(targetType: "designer" | "product", targetId: string | null | undefined) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !targetId) return;
    void supabase.rpc("record_page_visit" as never, { p_target_type: targetType, p_target_id: targetId } as never);
  }, [user, targetType, targetId]);

  useEffect(() => {
    if (!user || !targetId) return;
    const HEARTBEAT_SECONDS = 20;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      void supabase.rpc("add_dwell_seconds" as never, { p_target_type: targetType, p_target_id: targetId, p_seconds: HEARTBEAT_SECONDS } as never);
    };
    const id = window.setInterval(tick, HEARTBEAT_SECONDS * 1000);
    return () => window.clearInterval(id);
  }, [user, targetType, targetId]);
}
