
-- site_content: key/value CMS for banner/hero/footer copy
CREATE TABLE IF NOT EXISTS public.site_content (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.site_content TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_content TO authenticated;
GRANT ALL ON public.site_content TO service_role;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_content read all" ON public.site_content;
CREATE POLICY "site_content read all" ON public.site_content FOR SELECT USING (true);
DROP POLICY IF EXISTS "site_content admin write" ON public.site_content;
CREATE POLICY "site_content admin write" ON public.site_content
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.site_content_touch() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); NEW.updated_by = auth.uid(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_site_content_touch ON public.site_content;
CREATE TRIGGER trg_site_content_touch BEFORE INSERT OR UPDATE ON public.site_content
  FOR EACH ROW EXECUTE FUNCTION public.site_content_touch();

-- Seed defaults
INSERT INTO public.site_content (key, value) VALUES
  ('hero_eyebrow', '"Ausgabe 12 · Winter"'::jsonb),
  ('hero_headline', '"Mode, Interior und Kunst — von unabhängigen Designern."'::jsonb),
  ('hero_subline', '"Ein Raum, kein Katalog. PAWN kuratiert leise."'::jsonb),
  ('banner_fallback_quote', '"Wir zeichnen, was bleibt. Der Rest ist Rauschen."'::jsonb),
  ('atelier_feature', '{"title":"Im Atelier","text":"Handschriften, langsam gezeichnet.","image":null}'::jsonb),
  ('footer_lines', '["PAWN — kuratierte Handschriften.","Gegründet aus Respekt vor dem Handwerk."]'::jsonb),
  ('ausgabe_nummer', '12'::jsonb),
  ('show_seed_content', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Image usage contract
INSERT INTO public.contract_versions (kind, version, title, body_markdown, checksum, effective_from)
SELECT 'image_usage', 1, 'Einwilligung Bildnutzung',
$$Du erlaubst PAWN, die von dir eingereichten Bilder für Ausstellungs-, Redaktions- und Werbezwecke auf pawn.com sowie in offiziellen PAWN-Kommunikationskanälen (Newsletter, Social Media, Presseanfragen) zu verwenden. Die Bildrechte verbleiben bei dir. Du kannst diese Einwilligung jederzeit im Studio unter Einstellungen widerrufen; laufende Kampagnen mit diesen Bildern werden dann pausiert.$$,
md5('image_usage_v1_2026'), now()
WHERE NOT EXISTS (SELECT 1 FROM public.contract_versions WHERE kind = 'image_usage');

-- Consent revocation
ALTER TABLE public.designer_consents ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE public.designer_consents ADD COLUMN IF NOT EXISTS revoke_reason text;

-- Anonymous session -> user_id migration helper
CREATE OR REPLACE FUNCTION public.merge_anon_session(_session_id text, _user_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n int := 0;
BEGIN
  IF _user_id IS NULL OR _session_id IS NULL THEN RETURN 0; END IF;
  UPDATE public.domain_events
     SET payload = payload || jsonb_build_object('user_id', _user_id::text)
   WHERE type = 'ai.taste_signal'
     AND payload->>'session_id' = _session_id
     AND (payload->>'user_id' IS NULL);
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.ai_sessions SET user_id = _user_id
   WHERE session_id = _session_id AND user_id IS NULL;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.merge_anon_session(text, uuid) TO authenticated, service_role;
