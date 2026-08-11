ALTER TABLE public.designers ADD COLUMN IF NOT EXISTS verkaufsbereit boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.ist_verkaufsbereit(_designer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
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
  FROM public.designers d
  WHERE d.id = _designer_id;
$$;

CREATE OR REPLACE FUNCTION public.trg_designers_verkaufsbereit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.verkaufsbereit := COALESCE(public.ist_verkaufsbereit(NEW.id), false);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS designers_verkaufsbereit ON public.designers;
CREATE TRIGGER designers_verkaufsbereit
BEFORE UPDATE ON public.designers
FOR EACH ROW EXECUTE FUNCTION public.trg_designers_verkaufsbereit();

CREATE OR REPLACE FUNCTION public.trg_billing_verkaufsbereit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id uuid := COALESCE(NEW.designer_id, OLD.designer_id);
BEGIN
  UPDATE public.designers SET updated_at = now() WHERE id = _id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS billing_profiles_verkaufsbereit ON public.designer_billing_profiles;
CREATE TRIGGER billing_profiles_verkaufsbereit
AFTER INSERT OR UPDATE OR DELETE ON public.designer_billing_profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_billing_verkaufsbereit();

UPDATE public.designers d SET verkaufsbereit = COALESCE(public.ist_verkaufsbereit(d.id), false)
WHERE d.verkaufsbereit IS DISTINCT FROM COALESCE(public.ist_verkaufsbereit(d.id), false);