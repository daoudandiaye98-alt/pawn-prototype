-- Teil 22b: Das Versand-Werkzeug für Häuser. Der Designer ist der Verkäufer —
-- Rechnung und Bestätigung tragen die Daten des Hauses, nie die von PAWN.
-- Der bestehende fulfillment_status-Ablauf (neu → in Arbeit → verpackt → versendet →
-- zugestellt, Teil 9a-Vorlauf) bleibt unverändert; hier kommen nur die Daten dazu,
-- die für Rechnung, Versandkosten und Sendungsverfolgung fehlen.

-- 1) Rechnungsdaten je Haus — ohne die geht kein Versand ab.
CREATE TABLE public.designer_billing_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id uuid NOT NULL UNIQUE REFERENCES public.designers(id) ON DELETE CASCADE,
  legal_name text,
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  country text,
  tax_id text, -- Steuernummer ODER USt-IdNr., je nachdem was das Haus hat
  kleinunternehmer boolean NOT NULL DEFAULT false, -- §19 UStG
  return_address_line1 text,
  return_address_line2 text,
  return_postal_code text,
  return_city text,
  return_country text,
  invoice_next_number integer NOT NULL DEFAULT 1, -- eigener fortlaufender Rechnungsnummernkreis
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.designer_billing_profiles TO authenticated;
GRANT ALL ON public.designer_billing_profiles TO service_role;
ALTER TABLE public.designer_billing_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "designer manages own billing profile" ON public.designer_billing_profiles
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.designers d WHERE d.id = designer_billing_profiles.designer_id AND d.user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.designers d WHERE d.id = designer_billing_profiles.designer_id AND d.user_id = auth.uid())
  );

CREATE TRIGGER trg_billing_profiles_updated_at
  BEFORE UPDATE ON public.designer_billing_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Vergibt die nächste Rechnungsnummer für ein Haus, atomar — nur der Server (Edge
-- Function mit Service-Role) darf das, nie der Client direkt.
CREATE OR REPLACE FUNCTION public.next_invoice_number(_designer_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seq int;
  house int;
BEGIN
  UPDATE public.designer_billing_profiles
  SET invoice_next_number = invoice_next_number + 1, updated_at = now()
  WHERE designer_id = _designer_id
  RETURNING invoice_next_number - 1 INTO seq;

  IF seq IS NULL THEN
    RAISE EXCEPTION 'keine_rechnungsdaten';
  END IF;

  SELECT house_number INTO house FROM public.designers WHERE id = _designer_id;
  RETURN 'PW-' || COALESCE(house::text, '0') || '-' || lpad(seq::text, 5, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid) TO service_role;

-- 2) Versandkosten je Haus (Inland/EU/Weltweit, Pauschale + versandkostenfrei ab Betrag).
-- Leer = noch nicht eingerichtet; create-checkout behandelt fehlende Zonen als kostenlos
-- (freundliche Degradierung statt harter Fehler).
ALTER TABLE public.designers
  ADD COLUMN IF NOT EXISTS shipping_rates jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3) Bestellungen: Käufersprache, Lieferanschrift (von Stripe erfasst, bisher nie
-- gespeichert), Rechnungsnummer, E-Mail-Status. fulfillment_status/tracking_number/
-- carrier/shipped_at/delivered_at existieren bereits (Teil 9a-Vorlauf) — nur erweitern.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS buyer_locale text NOT NULL DEFAULT 'de',
  ADD COLUMN IF NOT EXISTS shipping_name text,
  ADD COLUMN IF NOT EXISTS shipping_address_line1 text,
  ADD COLUMN IF NOT EXISTS shipping_address_line2 text,
  ADD COLUMN IF NOT EXISTS shipping_postal_code text,
  ADD COLUMN IF NOT EXISTS shipping_city text,
  ADD COLUMN IF NOT EXISTS shipping_country text,
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS confirmation_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipped_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_email_error text;

-- 4) Rechnungs-PDFs: privater Speicherort, gleiches Muster wie mediathek/site-assets.
-- Pfadkonvention: '{order_id}.pdf' — RLS prüft direkt gegen die orders-Tabelle,
-- da Käufer UND Haus dieselbe Datei lesen dürfen müssen.
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "invoices_read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'invoices' AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id::text = split_part(name, '.', 1) AND o.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.designers d ON d.user_id = auth.uid()
      WHERE o.id::text = split_part(name, '.', 1)
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) it
          JOIN public.products p ON p.slug = (it->>'slug')
          WHERE p.designer_id = d.id
        )
    )
  )
);

CREATE POLICY "invoices_service_all" ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'invoices') WITH CHECK (bucket_id = 'invoices');
