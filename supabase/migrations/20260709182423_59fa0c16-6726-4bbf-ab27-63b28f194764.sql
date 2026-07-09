
-- 1. products.product_dna
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_dna jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.sync_tags_from_product_dna()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dna jsonb := COALESCE(NEW.product_dna, '{}'::jsonb);
BEGIN
  IF dna = '{}'::jsonb THEN RETURN NEW; END IF;
  NEW.tags := ARRAY(
    SELECT DISTINCT unnest(
      COALESCE(NEW.tags, ARRAY[]::text[]) ||
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(dna->'materials','[]'::jsonb))) ||
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(dna->'silhouette','[]'::jsonb))) ||
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(dna->'colors','[]'::jsonb))) ||
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(dna->'mood','[]'::jsonb)))
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_sync_tags_dna ON public.products;
CREATE TRIGGER trg_products_sync_tags_dna
BEFORE INSERT OR UPDATE OF product_dna ON public.products
FOR EACH ROW EXECUTE FUNCTION public.sync_tags_from_product_dna();

-- 2. ai_config: model_tiers
INSERT INTO public.ai_config(key, value)
VALUES ('model_tiers', '{
  "standard": {"model":"gpt-4o-mini", "label":"PAWN Standard"},
  "plus":     {"model":"gpt-4o",      "label":"PAWN+ Denkstufe"},
  "max":      {"model":"gpt-4o",      "label":"PAWN+ Max"}
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 3. persona_customer: Farb-Kompetenz ergänzen
UPDATE public.ai_config
SET value = jsonb_set(
  value,
  '{system_prompt}',
  to_jsonb(CAST('Du bist PAWN — ein leiser, warmer Berater und Guide durch das Kollektiv unabhängiger Designer. Dein Ziel: den Geschmack der Person so gut wie möglich verstehen. Antworte auf Deutsch, in maximal 2 kurzen Sätzen, stelle EINE konkrete warme Frage. Nutze Beschreibungen, Bildreferenzen und was du dir merkst. Empfiehl konkrete Namen erst, wenn du genug weißt.

Farb-Kompetenz (nutze bei Bedarf, ohne Fachbegriffe explizit zu machen):
- Warme Untertöne (Frühling/Herbst): Gold steht besser. Palette Frühling = pfirsich, warmes ecru, koralle, hellcamel. Palette Herbst = terrakotta, olivgrün, senfgelb, sattes bordeaux, kastanie.
- Kühle Untertöne (Sommer/Winter): Silber steht besser. Palette Sommer = puderblau, taubenblau, altrosa, kühles grau, zartes lavendel. Palette Winter = tiefschwarz, reinweiß, kobaltblau, magenta, eisblau.
- Frag konkret: "Steht dir Gold oder Silber näher am Gesicht?" um den Unterton zu bestimmen. Empfehle dann konkrete Stücke aus dem passenden Farbregister.' AS text)),
  true
)
WHERE key='persona_customer';

-- 4. Farb-Ontologie seeden
INSERT INTO public.fashion_ontology(term, kind, world, synonyms) VALUES
  ('warmes ecru',      'color', ARRAY['Mode','Interior'], ARRAY['creme','vanille','elfenbein']),
  ('pfirsich',         'color', ARRAY['Mode'],            ARRAY['peach','apricot']),
  ('koralle',          'color', ARRAY['Mode'],            ARRAY['coral','lachs']),
  ('hellcamel',        'color', ARRAY['Mode','Interior'], ARRAY['camel','sand','beige']),
  ('terrakotta',       'color', ARRAY['Mode','Interior'], ARRAY['ton','rost','ziegelrot']),
  ('olivgrün',         'color', ARRAY['Mode'],            ARRAY['oliv','khaki']),
  ('senfgelb',         'color', ARRAY['Mode'],            ARRAY['senf','curry']),
  ('sattes bordeaux',  'color', ARRAY['Mode','Interior'], ARRAY['bordeaux','burgunder','weinrot']),
  ('kastanie',         'color', ARRAY['Mode','Interior'], ARRAY['maroni','nussbraun']),
  ('puderblau',        'color', ARRAY['Mode'],            ARRAY['pastellblau','babyblau']),
  ('taubenblau',       'color', ARRAY['Mode','Interior'], ARRAY['grauton-blau','denimblau']),
  ('altrosa',          'color', ARRAY['Mode','Interior'], ARRAY['rose','dusty pink','puderrosa']),
  ('kühles grau',      'color', ARRAY['Mode','Interior'], ARRAY['aschgrau','graphit']),
  ('kobaltblau',       'color', ARRAY['Mode','Kunst'],    ARRAY['royalblau','tintenblau']),
  ('tiefschwarz',      'color', ARRAY['Mode','Interior','Kunst'], ARRAY['jetblack','schwarz']),
  ('reinweiß',         'color', ARRAY['Mode','Interior'], ARRAY['schneeweiß','white'])
ON CONFLICT (term) DO NOTHING;

-- 5. Vertrag v2 (Designer)
INSERT INTO public.contract_versions(kind, version, title, body_markdown, checksum, effective_from)
VALUES (
  'designer', 2, 'Designer-Vertrag mit PAWN (v2)',
$MD$
**Vorläufige Fassung — anwaltliche Prüfung ausstehend.**

## 1. Parteien
Zwischen der PAWN-Plattform (Betreiber: Daouda Ndiaye · PAWN, Kontakt: pawnstudio.co@gmail.com) und der/dem unabhängigen Designer:in ("Designer").

## 2. Leistungen von PAWN
- **Bühne**: kuratierte Präsentation im PAWN-Katalog (Mode / Interior / Kunst).
- **Retrospektive**: laufende Sichtbarkeit für vergangene Kollektionen.
- **Kampagnen-Studio**: browserbasiertes Video-Rendering + optionaler KI-Bewegtbild-Modus.
- **KI-Assistenz**: personalisierte Empfehlungen, Trend-Report, Studio-Copilot.
- **Zahlungsabwicklung**: Stripe-basierte Kaufabwicklung im Namen des Designers.

## 3. Wirtschaftliche Bedingungen
- **Provision**: 7% vom Bruttoverkaufspreis (netto zzgl. USt.) je verkauftem Stück.
- **Optionale Pläne**: Haus (0€/Monat), Atelier (19€/Monat), Maison (79€/Monat) — jederzeit monatlich kündbar.
- **Auszahlung**: monatlich, zum 15. jeden Monats, auf das im Studio hinterlegte Bankkonto.

## 4. Bildrechte
Der Designer räumt PAWN das nicht-exklusive, weltweite Nutzungsrecht an hochgeladenen Bildern/Videos zu Präsentations- und Marketingzwecken ein. **Widerruflich** durch Löschung des Studios oder Anfrage per Nachricht — PAWN entfernt betroffene Assets binnen 14 Tagen.

## 5. Laufzeit & Kündigung
Unbefristet. Kündigung durch beide Seiten jederzeit mit Frist von 14 Tagen zum Monatsende. Studio bleibt bis Ende der Frist aktiv.

## 6. Datenverarbeitung
Verarbeitung nach DSGVO. Details in /datenschutz. Kundendaten (Bestell-/Nachrichtendaten) werden dem Designer nur pseudonymisiert (z.B. "User 3") übermittelt — Klarnamen nur zur Fulfillment-Notwendigkeit.

## 7. Sonstiges
Gerichtsstand Deutschland, deutsches Recht. Sollte eine Klausel unwirksam sein, bleibt der Rest wirksam.
$MD$,
  md5('designer-v2-2026-07-09'),
  now()
)
ON CONFLICT (kind, version) DO NOTHING;

-- 6. Storage RLS für taste-uploads
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='taste_uploads_owner_read') THEN
    CREATE POLICY "taste_uploads_owner_read" ON storage.objects FOR SELECT
      USING (bucket_id='taste-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='taste_uploads_owner_insert') THEN
    CREATE POLICY "taste_uploads_owner_insert" ON storage.objects FOR INSERT
      WITH CHECK (bucket_id='taste-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='taste_uploads_owner_delete') THEN
    CREATE POLICY "taste_uploads_owner_delete" ON storage.objects FOR DELETE
      USING (bucket_id='taste-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='taste_uploads_anon_insert') THEN
    CREATE POLICY "taste_uploads_anon_insert" ON storage.objects FOR INSERT
      WITH CHECK (bucket_id='taste-uploads' AND (storage.foldername(name))[1]='anon');
  END IF;
END $$;

-- 7. business_profile: Rechtsfelder ergänzen
INSERT INTO public.ai_config(key, value)
VALUES ('business_profile', jsonb_build_object(
  'legal_name','Daouda Ndiaye · PAWN',
  'contact_email','pawnstudio.co@gmail.com',
  'address_line1','','address_line2','',
  'city','','postal_code','','country','Deutschland',
  'vat_id','','register',''
))
ON CONFLICT (key) DO UPDATE
SET value = public.ai_config.value ||
  jsonb_build_object(
    'legal_name',    COALESCE(public.ai_config.value->>'legal_name','Daouda Ndiaye · PAWN'),
    'contact_email', COALESCE(public.ai_config.value->>'contact_email','pawnstudio.co@gmail.com'),
    'address_line1', COALESCE(public.ai_config.value->>'address_line1',''),
    'address_line2', COALESCE(public.ai_config.value->>'address_line2',''),
    'city',          COALESCE(public.ai_config.value->>'city',''),
    'postal_code',   COALESCE(public.ai_config.value->>'postal_code',''),
    'country',       COALESCE(public.ai_config.value->>'country','Deutschland'),
    'vat_id',        COALESCE(public.ai_config.value->>'vat_id',''),
    'register',      COALESCE(public.ai_config.value->>'register','')
  );
