/**
 * Zentrale Namens-Fallback-Kette. NIEMALS eine E-Mail als Name rendern.
 * Reihenfolge: profile.display_name → designer.brand_name → application.legal_name → E-Mail-Localpart (kapitalisiert).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMyDesigner } from "@/features/studio/useMyDesigner";

function capitalizeLocalpart(email: string | null | undefined): string {
  if (!email) return "Gast";
  const local = email.split("@")[0] ?? "gast";
  const cleaned = local.replace(/[._-]+/g, " ").trim();
  return cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
    .slice(0, 40) || "Gast";
}

function stripEmail(s: string | null | undefined): string {
  if (!s) return "";
  const t = s.trim();
  if (!t || t.includes("@")) return "";
  return t;
}

export interface NameSources {
  profileName?: string | null;
  brandName?: string | null;
  legalName?: string | null;
  email?: string | null;
}

/** Vollständiger Anzeigename mit Fallback-Kette. Nie E-Mail. */
export function resolveDisplayName(s: NameSources): string {
  return (
    stripEmail(s.profileName) ||
    stripEmail(s.brandName) ||
    stripEmail(s.legalName) ||
    capitalizeLocalpart(s.email ?? null)
  );
}

/** Vorname aus dem Anzeigenamen (erstes Wort, kapitalisiert). */
export function resolveFirstName(s: NameSources): string {
  const full = resolveDisplayName(s);
  return full.split(/\s+/)[0] || "Gast";
}

/** Hook: kombiniert Profile, Designer und Bewerbung zu einem stabilen Namen. */
export function useDisplayName(): { displayName: string; firstName: string; loading: boolean } {
  const { user, profile } = useAuth();
  const { designer } = useMyDesigner();
  const [legalName, setLegalName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLegalName(null); setLoading(false); return; }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("designer_applications")
        .select("legal_name, brand_name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!alive) return;
      setLegalName(((data?.legal_name as string | null) ?? (data?.brand_name as string | null)) ?? null);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user?.id]);

  const src: NameSources = {
    profileName: profile?.displayName ?? null,
    brandName: designer?.brand_name ?? null,
    legalName,
    email: user?.email ?? null,
  };
  return { displayName: resolveDisplayName(src), firstName: resolveFirstName(src), loading };
}

/** Freundliche Rollen-Zeile — nie roher enum-Wert. */
export function friendlyRoleLine(roles: string[], houseNumber?: number | null): string {
  if (roles.includes("admin")) return "Team · PAWN";
  if (roles.includes("designer")) return houseNumber ? `Designer · Haus № ${houseNumber}` : "Designer";
  if (roles.includes("designer_applicant")) return "Bewerbung in Prüfung";
  return "Mitglied";
}
