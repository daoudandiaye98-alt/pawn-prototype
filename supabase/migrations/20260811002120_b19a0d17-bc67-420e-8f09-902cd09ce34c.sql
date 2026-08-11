ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS net_amount_cents integer,
  ADD COLUMN IF NOT EXISTS shipping_amount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_kleinunternehmer boolean,
  ADD COLUMN IF NOT EXISTS invoice_issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_path text,
  ADD COLUMN IF NOT EXISTS invoice_error text;

-- Lückenlose, eindeutige Nummernvergabe: Nummer und Bestellung werden in einem
-- einzigen Aufruf verheiratet. Zweiter Aufruf zur selben Bestellung liefert dieselbe
-- Nummer zurück (idempotent), fehlendes Rechnungsprofil liefert NULL statt Ausnahme.
CREATE OR REPLACE FUNCTION public.assign_invoice_number(_designer_id uuid, _order_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vorhanden text;
  seq int;
  house int;
  nummer text;
BEGIN
  SELECT invoice_number INTO vorhanden FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF vorhanden IS NOT NULL AND length(vorhanden) > 0 THEN
    RETURN vorhanden;
  END IF;

  UPDATE public.designer_billing_profiles
  SET invoice_next_number = invoice_next_number + 1, updated_at = now()
  WHERE designer_id = _designer_id
  RETURNING invoice_next_number - 1 INTO seq;

  IF seq IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT house_number INTO house FROM public.designers WHERE id = _designer_id;
  nummer := 'PW-' || COALESCE(house::text, '0') || '-' || lpad(seq::text, 5, '0');

  UPDATE public.orders SET invoice_number = nummer WHERE id = _order_id;
  RETURN nummer;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_invoice_number(uuid, uuid) TO service_role;