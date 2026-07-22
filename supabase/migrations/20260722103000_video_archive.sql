-- Teil 6a: Video-Archiv — jedes erzeugte Video landet automatisch hier,
-- plus der einmalige Rechte-Haken pro Haus vor dem ersten Render.

CREATE TYPE public.video_source AS ENUM ('designer', 'edition', 'jarvis');

CREATE TABLE public.video_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id uuid NOT NULL REFERENCES public.designers(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  url text NOT NULL,
  thumb text,
  source public.video_source NOT NULL DEFAULT 'designer',
  video_dna jsonb NOT NULL DEFAULT '{}'::jsonb,
  rights_granted boolean NOT NULL DEFAULT false,
  premiere boolean NOT NULL DEFAULT false,
  performance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_video_assets_designer_created ON public.video_assets(designer_id, created_at DESC);
CREATE INDEX idx_video_assets_premiere ON public.video_assets(premiere) WHERE premiere = true;

ALTER TABLE public.video_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "designer reads own videos" ON public.video_assets FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.designers d WHERE d.id = video_assets.designer_id AND d.user_id = auth.uid()));

CREATE POLICY "designer inserts own videos" ON public.video_assets FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.designers d WHERE d.id = video_assets.designer_id AND d.user_id = auth.uid()));

CREATE POLICY "public reads premiere videos" ON public.video_assets FOR SELECT
  USING (premiere = true);

CREATE POLICY "admin manages all videos" ON public.video_assets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Einmaliger Rechte-Haken pro Haus vor dem ersten Render (getrennt von image_usage_consent,
-- das nur die Nutzung von Produktbildern IN Kampagnen betrifft — dies hier erlaubt PAWN,
-- fertige Videos auf der Plattform/den PAWN-Kanälen mit Credit zu zeigen).
ALTER TABLE public.designers ADD COLUMN IF NOT EXISTS media_rights_granted_at timestamptz;

-- Atomarer Zähler für Première-Performance (premiere_views/shop_clicks), auch für anonyme
-- Besucher aufrufbar — SECURITY DEFINER mit hart begrenzter Metrik-Whitelist gegen Missbrauch.
CREATE OR REPLACE FUNCTION public.bump_video_metric(p_asset_id uuid, p_metric text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_metric NOT IN ('premiere_views', 'shop_clicks') THEN
    RETURN;
  END IF;
  UPDATE public.video_assets
  SET performance = jsonb_set(
    performance, ARRAY[p_metric],
    to_jsonb(COALESCE((performance->>p_metric)::int, 0) + 1)
  )
  WHERE id = p_asset_id AND premiere = true;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_video_metric(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_video_metric(uuid, text) TO anon, authenticated;

-- Jarvis-Wissen (Herzschlag, künftig): Videos ohne rights_granted dürfen nicht ins
-- Première-/Archiv-Feed der PAWN-Kanäle wandern — geprüft client-/edge-seitig beim Setzen von premiere=true.
