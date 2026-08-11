CREATE OR REPLACE FUNCTION public.ist_verkaufsbereit(_designer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = d.user_id AND r.role = 'admin')
    OR (
      COALESCE(d.stripe_charges_enabled, false)
      AND EXISTS (
        SELECT 1 FROM public.designer_billing_profiles b
        WHERE b.designer_id = d.id
          AND COALESCE(btrim(b.legal_name), '') <> ''
          AND COALESCE(btrim(b.address_line1), '') <> ''
          AND COALESCE(btrim(b.postal_code), '') <> ''
          AND COALESCE(btrim(b.city), '') <> ''
          AND COALESCE(btrim(b.country), '') <> ''
          AND (b.kleinunternehmer = true OR COALESCE(btrim(b.tax_id), '') <> '')
      )
      AND EXISTS (
        SELECT 1
        FROM jsonb_each(COALESCE(d.shipping_rates, '{}'::jsonb)) z
        WHERE jsonb_typeof(z.value) = 'object'
          AND (COALESCE((z.value->>'flat_cents')::int, 0) > 0
               OR COALESCE((z.value->>'free_from_cents')::int, 0) > 0)
      )
    )
  FROM public.designers d
  WHERE d.id = _designer_id;
$$;

UPDATE public.designers d SET verkaufsbereit = COALESCE(public.ist_verkaufsbereit(d.id), false)
WHERE d.verkaufsbereit IS DISTINCT FROM COALESCE(public.ist_verkaufsbereit(d.id), false);