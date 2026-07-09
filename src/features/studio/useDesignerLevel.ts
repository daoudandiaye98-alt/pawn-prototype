import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DesignerLevel {
  level: "bauer" | "springer" | "laeufer" | "turm" | "dame";
  glyph: string;
  label: string;
  next: string;
  progress: number; // 0..1
  stats: {
    products: number;
    published: number;
    campaigns_published: number;
    sales: number;
    has_portrait: boolean;
    has_story: boolean;
  };
}

const DEFAULT: DesignerLevel = {
  level: "bauer", glyph: "♟", label: "Bauer", next: "Springer", progress: 0,
  stats: { products: 0, published: 0, campaigns_published: 0, sales: 0, has_portrait: false, has_story: false },
};

export function useDesignerLevel(designerId?: string) {
  const [level, setLevel] = useState<DesignerLevel>(DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!designerId) { setLoading(false); return; }
    let alive = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase.rpc("designer_level" as never, { _designer_id: designerId } as never);
      if (!alive) return;
      if (data && typeof data === "object") setLevel(data as unknown as DesignerLevel);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [designerId]);

  return { level, loading };
}
