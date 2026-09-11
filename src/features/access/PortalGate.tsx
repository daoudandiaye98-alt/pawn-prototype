import { type ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * KEIN Waechter — ein Wegweiser.
 *
 * Teil L12: dieser Baustein hat frueher wie ein Waechter ausgesehen und keiner
 * gewesen. Er prueft keine Rolle und hat nie eine geprueft; wer angemeldet war,
 * kam durch, egal als was. Weil er an /portal und /studio/onboarding hing und
 * RoleGate an allem anderen, gaben zwei Waechter zwei Antworten fuer dieselbe
 * Flaeche. Zutritt entscheidet jetzt allein RoleGate.
 *
 * Was hier bleibt, ist die eine Frage, die RoleGate nicht beantworten kann:
 * hat dieses Haus den Einzug abgeschlossen? Wenn nicht, geht es zuerst dorthin.
 *
 * Deshalb gehoert PortalGate IMMER INNERHALB eines <RoleGate role="designer">.
 * Allein davor gestellt laesst er jeden angemeldeten Besucher durch.
 */
export function PortalGate({ children }: { children: ReactNode }) {
  const { user, roles, loading } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState<"pending" | "in_progress" | "complete" | "unknown" | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || !roles.includes("designer")) { setStatus("unknown"); return; }
    (async () => {
      const { data } = await supabase
        .from("designer_onboarding_sessions")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();
      setStatus((data?.status as typeof status) ?? "unknown");
    })();
  }, [user, roles, loading]);

  if (loading || status === null) return null;

  const onOnboardingRoute = location.pathname.startsWith("/portal/onboarding");

  if (roles.includes("designer") && (status === "pending" || status === "in_progress") && !onOnboardingRoute) {
    return <Navigate to="/portal/onboarding" replace />;
  }
  if (roles.includes("designer") && status === "complete" && onOnboardingRoute) {
    return <Navigate to="/portal" replace />;
  }

  return <>{children}</>;
}
