import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface StudioDesigner {
  id: string;
  user_id: string;
  slug: string;
  brand_name: string;
  location: string | null;
  country: string | null;
  story: string | null;
  manifesto: string | null;
  quote: string | null;
  quote_role: string | null;
  collection_title: string | null;
  hero_image_url: string | null;
  banner_url: string | null;
  avatar_url: string | null;
  status: string;
  house_number: number | null;
  hausseite_cover_shown_at: string | null;
  created_at: string | null;
  brand_dna: Record<string, unknown> | null;
  aussenauge: Record<string, unknown> | null;
  plan: "haus" | "atelier" | "maison";
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
  stripe_details_submitted: boolean;
  page_published_at: string | null;
  dismissed_suggestions: Record<string, string>;
  shipping_rates: Record<string, unknown> | null;
  vat_rate: number;
  return_window_days: number;
  preferred_language: string;
  pawn_guide_enabled: boolean;
  studio_last_seen_at: string | null;
  onboarding_state: Record<string, unknown>;
  weekly_impulse: string | null;
}


/** The one designer row owned by the current user (or null if none yet). */
export function useMyDesigner() {
  const { user } = useAuth();
  const [designer, setDesigner] = useState<StudioDesigner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!user) { setDesigner(null); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("designers")
      .select("id, user_id, slug, brand_name, location, country, story, manifesto, quote, quote_role, collection_title, hero_image_url, banner_url, avatar_url, status, house_number, hausseite_cover_shown_at, created_at, brand_dna, aussenauge, plan, stripe_account_id, stripe_charges_enabled, stripe_details_submitted, page_published_at, dismissed_suggestions, shipping_rates, vat_rate, return_window_days, preferred_language, pawn_guide_enabled, studio_last_seen_at, onboarding_state, weekly_impulse")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) setError(error.message);
    setDesigner((data as StudioDesigner | null) ?? null);
    setLoading(false);
  };

  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);
  return { designer, loading, error, refresh };
}
