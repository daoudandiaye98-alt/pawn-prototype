
-- 1) Backfill profiles.display_name from designer_applications for existing users
UPDATE public.profiles p
SET display_name = COALESCE(
  NULLIF(BTRIM(p.display_name), ''),
  (SELECT NULLIF(BTRIM(a.legal_name), '') FROM public.designer_applications a WHERE a.user_id = p.id ORDER BY a.created_at DESC LIMIT 1),
  (SELECT NULLIF(BTRIM(a.brand_name), '') FROM public.designer_applications a WHERE a.user_id = p.id ORDER BY a.created_at DESC LIMIT 1),
  p.display_name
)
WHERE p.display_name IS NULL OR BTRIM(p.display_name) = '' OR p.display_name ILIKE '%@%';

-- 2) Orders: fulfillment status chain + tracking
DO $$ BEGIN
  CREATE TYPE public.fulfillment_status AS ENUM ('new','in_progress','packed','shipped','delivered');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_status public.fulfillment_status NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS carrier text,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- 3) Seed AI personas + directives (Leitprinzip first)
INSERT INTO public.ai_config (key, value) VALUES
  ('directives', jsonb_build_object('items', jsonb_build_array(
    'PAWN fühlt sich an wie ein Spiel, während man real einen Modeshop aufbaut. Eine klare nächste Aktion statt vieler Optionen. Kurze Schritte, Klartext, sanfte Feier-Momente. Wenig gleichzeitige Information. Nie Fachbegriffe, nie Diagnose.'
  ))),
  ('persona_customer', jsonb_build_object('system_prompt',
    'Du bist PAWN — ein leiser, warmer Berater und Guide durch das Kollektiv unabhängiger Designer. Dein Ziel: den Geschmack der Person so gut wie möglich verstehen. Antworte auf Deutsch, in maximal 2 kurzen Sätzen, stelle EINE konkrete warme Frage. Nutze Beschreibungen, Bildreferenzen und was du dir merkst. Empfiehl konkrete Namen erst, wenn du genug weißt.'
  )),
  ('persona_designer', jsonb_build_object('system_prompt',
    'Du bist PAWN Copilot — Organisations-Begleiter für unabhängige Designer. Du kennst die offenen Aufgaben und den nächsten Zug. Antworte auf Deutsch, sachlich, ohne Marketing-Floskeln. Ein konkreter Vorschlag pro Antwort. Erkläre Upload, Kampagnen, Versand in einfachen Schritten. Erinnere sanft, priorisiere, feiere kleine Fortschritte kurz.'
  )),
  ('persona_admin', jsonb_build_object('system_prompt',
    'Du bist PAWN im Admin-Modus — voller Zugriff, technisch präzise, deutsch. Auf Nachfrage zeigst du offen dein aktives Kontextpaket und die Direktiven. Antworte knapp, mit strukturierten Vorschlägen, ohne zu beschönigen.'
  ))
ON CONFLICT (key) DO NOTHING;

-- 4) Extend ai_integrations kind check (add 'pinterest' if enum-like check exists; keep as text otherwise)
-- Assuming ai_integrations.kind is text without a CHECK — nothing to alter.

-- 5) Designer level function (Bauer/Springer/Läufer/Turm/Dame)
CREATE OR REPLACE FUNCTION public.designer_level(_designer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.designers%ROWTYPE;
  product_count int;
  published_count int;
  campaigns_published int;
  sales_count int;
  has_portrait bool;
  has_story bool;
  level text := 'bauer';
  glyph text := '♟';
  label text := 'Bauer';
  next_label text := 'Springer';
  progress numeric := 0;
BEGIN
  SELECT * INTO d FROM public.designers WHERE id = _designer_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('level','bauer','glyph','♟','label','Bauer','next','Springer','progress',0);
  END IF;

  SELECT count(*), count(*) FILTER (WHERE status = 'published')
    INTO product_count, published_count
    FROM public.products WHERE designer_id = _designer_id;

  SELECT count(*) INTO campaigns_published
    FROM public.campaigns WHERE designer_id = _designer_id AND status IN ('approved','published');

  SELECT count(DISTINCT o.id) INTO sales_count
    FROM public.orders o
    WHERE o.status = 'paid'
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(o.items::jsonb, '[]'::jsonb)) it
        JOIN public.products p ON p.slug = (it->>'slug')
        WHERE p.designer_id = _designer_id
      );

  has_portrait := (d.avatar_url IS NOT NULL OR d.hero_image_url IS NOT NULL);
  has_story := (d.story IS NOT NULL AND length(btrim(d.story)) > 40);

  IF sales_count >= 10 OR (campaigns_published >= 3 AND sales_count >= 5) THEN
    level := 'dame'; glyph := '♛'; label := 'Dame'; next_label := 'Dame'; progress := 1;
  ELSIF sales_count >= 1 THEN
    level := 'turm'; glyph := '♜'; label := 'Turm'; next_label := 'Dame';
    progress := LEAST(1, sales_count::numeric / 10);
  ELSIF campaigns_published >= 1 THEN
    level := 'laeufer'; glyph := '♝'; label := 'Läufer'; next_label := 'Turm';
    progress := 0.6;
  ELSIF has_portrait AND has_story AND published_count >= 1 THEN
    level := 'springer'; glyph := '♞'; label := 'Springer'; next_label := 'Läufer';
    progress := 0.4;
  ELSE
    level := 'bauer'; glyph := '♟'; label := 'Bauer'; next_label := 'Springer';
    progress := (
      (CASE WHEN has_portrait THEN 1 ELSE 0 END) +
      (CASE WHEN has_story THEN 1 ELSE 0 END) +
      (CASE WHEN published_count >= 1 THEN 1 ELSE 0 END)
    )::numeric / 3;
  END IF;

  RETURN jsonb_build_object(
    'level', level,
    'glyph', glyph,
    'label', label,
    'next', next_label,
    'progress', progress,
    'stats', jsonb_build_object(
      'products', product_count,
      'published', published_count,
      'campaigns_published', campaigns_published,
      'sales', sales_count,
      'has_portrait', has_portrait,
      'has_story', has_story
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.designer_level(uuid) TO authenticated, service_role;
