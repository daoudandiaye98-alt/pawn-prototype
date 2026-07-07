
-- 1. brand_dna column
ALTER TABLE public.designers ADD COLUMN IF NOT EXISTS brand_dna jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. recompute function
CREATE OR REPLACE FUNCTION public.recompute_brand_dna(_designer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  worlds jsonb;
  signals jsonb;
  price_min numeric;
  price_max numeric;
  price_avg numeric;
  stock_ct int;
  mto_ct int;
  total_products int;
BEGIN
  SELECT count(*) INTO total_products FROM public.products WHERE designer_id = _designer_id AND status = 'published';

  IF total_products = 0 THEN
    UPDATE public.designers SET brand_dna = '{}'::jsonb WHERE id = _designer_id;
    RETURN;
  END IF;

  -- worlds distribution
  SELECT jsonb_object_agg(w, ratio) INTO worlds FROM (
    SELECT world::text AS w, round((count(*)::numeric / total_products)::numeric, 3) AS ratio
    FROM public.products
    WHERE designer_id = _designer_id AND status = 'published'
    GROUP BY world
  ) t;

  -- top tags
  SELECT jsonb_agg(tag ORDER BY freq DESC) INTO signals FROM (
    SELECT tag, count(*) AS freq
    FROM public.products, unnest(coalesce(tags, ARRAY[]::text[])) AS tag
    WHERE designer_id = _designer_id AND status = 'published'
    GROUP BY tag
    ORDER BY freq DESC
    LIMIT 8
  ) t;

  SELECT min(price), max(price), round(avg(price)::numeric, 0)
    INTO price_min, price_max, price_avg
    FROM public.products WHERE designer_id = _designer_id AND status = 'published';

  SELECT
    count(*) FILTER (WHERE inventory_mode = 'stock'),
    count(*) FILTER (WHERE inventory_mode = 'made_to_order')
    INTO stock_ct, mto_ct
    FROM public.products WHERE designer_id = _designer_id AND status = 'published';

  UPDATE public.designers SET brand_dna = jsonb_build_object(
    'worlds', COALESCE(worlds, '{}'::jsonb),
    'signals', COALESCE(signals, '[]'::jsonb),
    'price_band', jsonb_build_object('min', price_min, 'max', price_max, 'avg', price_avg),
    'inventory_mix', jsonb_build_object('stock', stock_ct, 'made_to_order', mto_ct),
    'product_count', total_products,
    'updated_at', now()
  ) WHERE id = _designer_id;
END;
$$;

-- 3. trigger on products
CREATE OR REPLACE FUNCTION public.trg_recompute_brand_dna()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_brand_dna(OLD.designer_id);
    RETURN OLD;
  END IF;
  PERFORM public.recompute_brand_dna(NEW.designer_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_brand_dna ON public.products;
CREATE TRIGGER products_brand_dna
AFTER INSERT OR UPDATE OF status, world, tags, price, inventory_mode OR DELETE
ON public.products
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_brand_dna();

-- 4. seed help_topics into ai_config if missing
INSERT INTO public.ai_config (key, value)
VALUES ('help_topics', jsonb_build_object(
  'topics', jsonb_build_array(
    jsonb_build_object('q', 'Wie lege ich ein Stück an?', 'a', 'Öffne "Kollektion" in der Sidebar und wähle "Neues Stück anlegen". Fülle Name, Welt, Preis und mindestens ein Bild aus. Speichere zunächst als Entwurf — wenn alles stimmt, veröffentliche das Stück über den Schalter auf der Karte.'),
    jsonb_build_object('q', 'Wann bekomme ich mein Geld?', 'a', 'Nach jeder bezahlten Bestellung wird der Betrag abzüglich unserer Beteiligung deinem Konto gutgeschrieben. Auszahlungen erfolgen monatlich, sobald du unter "Auszahlung" deine Bankverbindung hinterlegt hast.'),
    jsonb_build_object('q', 'Wie funktionieren Kampagnen?', 'a', 'PAWN schlägt dir passende Kampagnen vor (Editorial, Instagram, Newsletter). Du prüfst den Entwurf und gibst ihn frei — nichts wird ohne deine Zustimmung veröffentlicht. Freigegebene Kampagnen erscheinen in unserer Kuratierung.')
  )
))
ON CONFLICT (key) DO NOTHING;
