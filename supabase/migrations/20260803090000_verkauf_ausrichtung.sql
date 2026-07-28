-- Teil 16c: Auf Verkauf ausrichten.
-- a) Jedes Medium bekommt ein Ziel: ein direktes product_id (statt nur im usages-jsonb
--    vergraben) oder — wenn ohne Stück erzeugt — einen kurzen Zweck-Text.
-- c) Erfolg wird am Verkauf/Klick gemessen: media_assets bekommt performance jsonb wie
--    video_assets, damit Studio + Jarvis wissen, welches Bild Aufmerksamkeit bringt.
-- e) PAWNs Kanal kuratiert statt flutet: das automatische Enqueue wird zu einem Vorschlag,
--    kein direktes Queuing mehr — der Admin (mit Jarvis' Begründung) entscheidet, was
--    tatsächlich in den Posting-Slot rückt.

ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS advertises_text text,
  ADD COLUMN IF NOT EXISTS performance jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Best-effort Backfill: wo usages bereits einen "produkt"-Eintrag trägt, das Ziel auch
-- direkt als Spalte lesbar machen (einfachere Abfragen für Studio/Ausgabe/Première).
UPDATE public.media_assets ma
SET product_id = (elem->>'product_id')::uuid
FROM jsonb_array_elements(ma.usages) AS elem
WHERE ma.product_id IS NULL
  AND elem->>'type' = 'produkt'
  AND elem->>'product_id' IS NOT NULL
  AND (elem->>'product_id') ~ '^[0-9a-f-]{36}$';

-- Bisher konnten nur Eigentümer/Admin media_assets überhaupt lesen — auf der
-- veröffentlichten Hausseite/Produktseite braucht es aber auch für Besucher:innen
-- Lesezugriff, sonst laden dort verlinkte Bilder/Videos gar nicht erst (Lücke, die
-- 16c erst sichtbar macht: ohne das kann kein Medium zum Kauf führen).
CREATE POLICY "public reads media of active houses" ON public.media_assets FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.designers d WHERE d.id = media_assets.designer_id AND d.status = 'active')
  );

CREATE OR REPLACE FUNCTION public.bump_media_metric(p_media_asset_id uuid, p_metric text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_metric NOT IN ('views', 'shop_clicks') THEN
    RETURN;
  END IF;
  UPDATE public.media_assets
  SET performance = jsonb_set(
    performance, ARRAY[p_metric],
    to_jsonb(COALESCE((performance->>p_metric)::int, 0) + 1)
  )
  WHERE id = p_media_asset_id;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_media_metric(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_media_metric(uuid, text) TO anon, authenticated;

-- Aufrufe je Stück (nicht je Medium — das reicht für "wie nah ist der erste Verkauf",
-- Shop-Klicks je Bild bleiben in media_assets.performance). domain_events verlangt
-- 'authenticated' (die Mehrheit der Besucher ist es nicht) — deshalb ein einfacher
-- Zähler direkt am Produkt, gesetzt über eine SECURITY DEFINER-Funktion wie oben.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.bump_product_view(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products SET view_count = view_count + 1 WHERE id = p_product_id AND status = 'published';
END;
$$;

REVOKE ALL ON FUNCTION public.bump_product_view(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_product_view(uuid) TO anon, authenticated;

-- Kuratiertes Posting statt automatischem Massen-Queuing: neue Zwischenstufe
-- "vorschlag" — Jarvis kann begründen, der Admin entscheidet, ob es in den echten
-- Slot rückt. Bestehende 'queued'/'posted'/'failed'/'cancelled' bleiben unverändert.
ALTER TYPE public.posting_status ADD VALUE IF NOT EXISTS 'vorschlag';

ALTER TABLE public.posting_queue
  ADD COLUMN IF NOT EXISTS story_reason text,
  ADD COLUMN IF NOT EXISTS story_score numeric;

CREATE OR REPLACE FUNCTION public.enqueue_campaign_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND NEW.kind = 'video'
     AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'approved')
     AND (NEW.content ? 'asset_url') THEN
    IF EXISTS (SELECT 1 FROM public.posting_queue WHERE campaign_id = NEW.id) THEN
      RETURN NEW;
    END IF;
    -- Kein automatischer Slot mehr — landet als Vorschlag, wartet auf Freigabe.
    INSERT INTO public.posting_queue (campaign_id, channel, scheduled_at, status)
    VALUES (NEW.id, 'pawn_instagram', now(), 'vorschlag');
  END IF;
  RETURN NEW;
END;
$$;

-- Admin (ggf. über Jarvis' Vorschlag) hebt einen Vorschlag in die echte Kette:
-- gleiche Fair-Share-Logik (max 3/Tag, Plan-Priorität) wie zuvor beim Auto-Enqueue,
-- nur jetzt bewusst ausgelöst statt automatisch.
CREATE OR REPLACE FUNCTION public.promote_posting_suggestion(p_queue_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  slot_day date := (now() AT TIME ZONE 'Europe/Berlin')::date;
  count_on_day int;
  slot_time timestamptz;
  landed_day date;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.posting_queue WHERE id = p_queue_id AND status = 'vorschlag') THEN
    RETURN;
  END IF;
  LOOP
    SELECT count(*) INTO count_on_day
      FROM public.posting_queue
      WHERE (scheduled_at AT TIME ZONE 'Europe/Berlin')::date = slot_day
        AND status IN ('queued', 'posted');
    IF count_on_day < 3 THEN
      slot_time := (slot_day::timestamp + interval '10 hours' + (count_on_day * interval '4 hours')) AT TIME ZONE 'Europe/Berlin';
      IF slot_time < now() THEN slot_time := now() + interval '2 hours'; END IF;
      landed_day := slot_day;
      EXIT;
    END IF;
    slot_day := slot_day + 1;
  END LOOP;

  UPDATE public.posting_queue SET status = 'queued', scheduled_at = slot_time WHERE id = p_queue_id;
  PERFORM public.resequence_posting_queue_day(landed_day);
END;
$$;

REVOKE ALL ON FUNCTION public.promote_posting_suggestion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_posting_suggestion(uuid) TO authenticated;
