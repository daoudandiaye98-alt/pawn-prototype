import { type ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * Ensures approved designers complete onboarding before reaching the Studio.
 * If session status !== 'complete' and user is not on /portal/onboarding,
 * redirect them there.
 *
 * Non-designers pass through untouched (RoleGate handles their case elsewhere).
 * Unauthenticated visitors pass through (prototype mode).
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
