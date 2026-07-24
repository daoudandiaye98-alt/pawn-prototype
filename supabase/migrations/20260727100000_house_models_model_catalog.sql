-- Teil 11b: Besetzung & Ort — ein wiederverwendbares Haus-Model, damit dasselbe Gesicht über
-- mehrere Kampagnen läuft (löst das in Teil 6b versprochene konsistente Modellgesicht ein).
CREATE TABLE public.house_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id uuid NOT NULL REFERENCES public.designers(id) ON DELETE CASCADE,
  name text NOT NULL,
  ausstrahlung text,
  altersgruppe text,
  haar text,
  hautton text,
  statur text,
  freitext text,
  base_image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.house_models TO authenticated;
GRANT ALL ON public.house_models TO service_role;
ALTER TABLE public.house_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "designer manages own house_models" ON public.house_models FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.designers d WHERE d.id = house_models.designer_id AND d.user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.designers d WHERE d.id = house_models.designer_id AND d.user_id = auth.uid())
  );

-- Modellwahl für die kinematische Erzeugung: der Designer wählt selbst, welches Modell erzeugt.
-- Editierbar unter /admin/ki, damit neue Modelle ohne Deploy dazukommen. Zwei echte Stufen —
-- keine erfundene dritte Stufe ohne echtes Modell dahinter.
INSERT INTO public.ai_config (key, value)
VALUES ('model_catalog', '[
  {"id": "video_schnell", "label": "Schnell & günstig", "kind": "video", "strength": "schnell", "credits": 5, "active": true, "fal_model": "fal-ai/wan/v2.2-a14b/image-to-video/lora"},
  {"id": "video_beste", "label": "Beste Qualität", "kind": "video", "strength": "beste", "credits": 12, "active": true, "fal_model": "fal-ai/kling-video/v2.1/standard/image-to-video"}
]'::jsonb)
ON CONFLICT (key) DO NOTHING;
