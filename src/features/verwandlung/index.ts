/**
 * Teil 15c: Die Verwandlung sichtbar machen. Fünf Stufen aus echtem Tun — nie käuflich, nie
 * durch einen Plan erreichbar (Pläne kaufen Werkzeuge, keine Ränge). Eigenständig neben der
 * bestehenden Bauer→Dame-Ansehensleiter (useDesignerLevel) — diese hier bildet exakt die fünf
 * im Briefing genannten Meilensteine ab, inklusive Première und eigenem Haus-Thema.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface HouseMilestones {
  erstes_stueck_at: string | null;
  erste_kampagne_at: string | null;
  erster_verkauf_at: string | null;
  erste_premiere_at: string | null;
  eigene_welt_at: string | null;
  verwandlung_at: string | null;
}

export interface VerwandlungStep {
  key: keyof HouseMilestones;
  label: string;
  glyph: string;
  to: string;
}

export const VERWANDLUNG_STEPS: VerwandlungStep[] = [
  { key: "erstes_stueck_at", label: "Erstes Stück", glyph: "♟", to: "/studio/produkte" },
  { key: "erste_kampagne_at", label: "Erste Kampagne", glyph: "♞", to: "/studio/kampagnen" },
  { key: "erster_verkauf_at", label: "Erster Verkauf", glyph: "♝", to: "/studio/bestellungen" },
  { key: "erste_premiere_at", label: "Erste Première", glyph: "♜", to: "/studio/videothek" },
  { key: "eigene_welt_at", label: "Eigene Welt gestaltet", glyph: "♛", to: "/studio/hausseite" },
];

const EMPTY: HouseMilestones = {
  erstes_stueck_at: null, erste_kampagne_at: null, erster_verkauf_at: null,
  erste_premiere_at: null, eigene_welt_at: null, verwandlung_at: null,
};

/** Lädt den Stand, stößt vorher eine Neuberechnung an (günstig, idempotent — Ratchet). */
export function useHouseMilestones(designerId?: string) {
  const [milestones, setMilestones] = useState<HouseMilestones>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!designerId) { setLoading(false); return; }
    let alive = true;
    (async () => {
      setLoading(true);
      await supabase.rpc("recompute_house_milestones" as never, { p_designer_id: designerId } as never).then(() => {}, () => {});
      const { data } = await supabase.from("house_milestones" as never).select("*").eq("designer_id", designerId).maybeSingle();
      if (!alive) return;
      setMilestones((data as unknown as HouseMilestones) ?? EMPTY);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [designerId]);

  return { milestones, loading };
}

export function nextVerwandlungStep(m: HouseMilestones): VerwandlungStep | null {
  return VERWANDLUNG_STEPS.find((s) => !m[s.key]) ?? null;
}

/** Für das dezente Zeichen auf der Hausseite: die zuletzt erreichte Stufe (nicht die nächste
    fehlende — das ist Sache des Studios). Jedes Haus beginnt als Bauer. */
export function currentVerwandlungGlyph(m: HouseMilestones): { glyph: string; label: string } {
  if (m.verwandlung_at) return { glyph: "♛", label: "Verwandlung erreicht" };
  const reached = [...VERWANDLUNG_STEPS].reverse().find((s) => !!m[s.key]);
  return reached ? { glyph: reached.glyph, label: reached.label } : { glyph: "♟", label: "Bauer" };
}
