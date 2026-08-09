-- AUFTRAG Teil 37, AP2 — "Erster Zug": Attribution vom Akquise-Lead zur Bewerbung.
-- Der Wizard selbst schreibt in bereits bestehende Tabellen (designer_brand_dna,
-- designer_page_blocks, designer_onboarding_sessions) — hier fehlt nur die Brücke,
-- damit eine spätere Bewerbung nachvollziehbar auf den ursprünglichen Akquise-Lead
-- zurückgeführt werden kann (Funnel-Attribution).

ALTER TABLE public.designer_applications
  ADD COLUMN IF NOT EXISTS acquisition_lead_id uuid REFERENCES public.acquisition_leads(id) ON DELETE SET NULL;