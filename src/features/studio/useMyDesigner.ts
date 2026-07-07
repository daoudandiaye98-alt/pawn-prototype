import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface StudioDesigner {
  id: string;
  slug: string;
  brand_name: string;
  location: string | null;
  country: string | null;
  story: string | null;
  quote: string | null;
  quote_role: string | null;
  hero_image_url: string | null;
  banner_url: string | null;
  avatar_url: string | null;
  status: string;
  house_number: number | null;
  created_at: string | null;
  brand_dna: Record<string, unknown> | null;
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
      .select("id, slug, brand_name, location, country, story, quote, quote_role, hero_image_url, banner_url, avatar_url, status, house_number, created_at, brand_dna")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) setError(error.message);
    setDesigner((data as StudioDesigner | null) ?? null);
    setLoading(false);
  };

  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);
  return { designer, loading, error, refresh };
}
