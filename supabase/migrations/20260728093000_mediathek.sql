-- Teil 12b: Mediathek — zentrale Ablage je Haus für alles Erzeugte und Hochgeladene.
-- video_assets aus Teil 6a bleibt unangetastet und weiter die Quelle für Première/Admin-Archiv/
-- Videothek — media_assets verlinkt bestehende Videos zusätzlich (video_asset_id), statt sie zu
-- migrieren, damit dort nichts verloren geht oder riskant umgeschrieben werden muss.

CREATE TYPE public.media_kind AS ENUM ('bild', 'video');
CREATE TYPE public.media_origin AS ENUM ('upload', 'erzeugt', 'edition');
CREATE TYPE public.media_review_status AS ENUM ('privat', 'eingereicht', 'angenommen', 'abgelehnt');

CREATE TABLE public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id uuid NOT NULL REFERENCES public.designers(id) ON DELETE CASCADE,
  kind public.media_kind NOT NULL,
  origin public.media_origin NOT NULL DEFAULT 'upload',
  url text NOT NULL,
  thumb_url text,
  title text,
  note text,
  -- Verwendungen: [{"type":"produkt","product_id":"..."},{"type":"banner_vormerkung"},{"type":"archiv"}]
  usages jsonb NOT NULL DEFAULT '[]'::jsonb,
  rights_granted boolean NOT NULL DEFAULT false,
  review_status public.media_review_status NOT NULL DEFAULT 'privat',
  review_note text,
  video_asset_id uuid REFERENCES public.video_assets(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX media_assets_designer_created_idx ON public.media_assets (designer_id, created_at DESC);
CREATE INDEX media_assets_review_idx ON public.media_assets (review_status) WHERE review_status = 'eingereicht';

GRANT SELECT, INSERT, UPDATE ON public.media_assets TO authenticated;
GRANT ALL ON public.media_assets TO service_role;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "designer manages own media" ON public.media_assets FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.designers d WHERE d.id = media_assets.designer_id AND d.user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.designers d WHERE d.id = media_assets.designer_id AND d.user_id = auth.uid())
  );

-- Die Entscheidung (angenommen/abgelehnt) bleibt beim Admin — ein Haus kann einreichen,
-- aber sich nicht selbst annehmen, auch nicht über einen direkten API-Aufruf.
CREATE OR REPLACE FUNCTION public.guard_media_review_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.review_status IN ('angenommen', 'abgelehnt')
     AND OLD.review_status IS DISTINCT FROM NEW.review_status
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'nur_admin_entscheidet';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER media_assets_guard_review
BEFORE UPDATE ON public.media_assets
FOR EACH ROW EXECUTE FUNCTION public.guard_media_review_status();

-- Eigener Speicherort für Mediathek-Uploads, gleiches Muster wie die übrigen Buckets: privat,
-- signierte URLs, Zugriff nur fürs eigene Haus bzw. Admin.
INSERT INTO storage.buckets (id, name, public)
VALUES ('mediathek', 'mediathek', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "mediathek_owner_read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'mediathek' AND (
    public.has_role(auth.uid(), 'admin') OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY "mediathek_owner_write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'mediathek' AND (
    public.has_role(auth.uid(), 'admin') OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY "mediathek_owner_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'mediathek' AND (
    public.has_role(auth.uid(), 'admin') OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY "mediathek_service_all" ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'mediathek') WITH CHECK (bucket_id = 'mediathek');

-- Bestehende Videos einmalig einhängen, damit sie von Anfang an auch in der Mediathek auftauchen.
INSERT INTO public.media_assets (designer_id, kind, origin, url, rights_granted, video_asset_id, campaign_id, created_at)
SELECT
  va.designer_id,
  'video'::public.media_kind,
  CASE va.source WHEN 'edition' THEN 'edition'::public.media_origin ELSE 'erzeugt'::public.media_origin END,
  va.url,
  va.rights_granted,
  va.id,
  va.campaign_id,
  va.created_at
FROM public.video_assets va;
