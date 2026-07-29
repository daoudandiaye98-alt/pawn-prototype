ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS advertises_text text,
  ADD COLUMN IF NOT EXISTS performance jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.media_assets ma
SET product_id = sub.pid
FROM (
  SELECT m.id, (elem->>'product_id')::uuid AS pid
  FROM public.media_assets m
  CROSS JOIN LATERAL jsonb_array_elements(m.usages) AS elem
  WHERE m.product_id IS NULL
    AND elem->>'type' = 'produkt'
    AND elem->>'product_id' IS NOT NULL
    AND (elem->>'product_id') ~ '^[0-9a-f-]{36}$'
) sub
WHERE ma.id = sub.id AND ma.product_id IS NULL;

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

ALTER TABLE public.posting_queue
  ADD COLUMN IF NOT EXISTS story_reason text,
  ADD COLUMN IF NOT EXISTS story_score numeric;