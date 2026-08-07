-- Teil 25 (Das Studio spricht Englisch), Punkt 5: Übersicht fehlender englischer
-- Fassungen unter /admin/texte-bilder. Die deutschen/englischen Studio-Oberflächentexte
-- leben als statisches Wörterbuch in src/lib/i18n.tsx (Code, kein Deploy-Aufwand für
-- Frontend-Änderungen) — diese Tabelle ist die einzige Möglichkeit, eine fehlende oder
-- verbesserte englische Fassung ohne Code-Änderung zu pflegen. t() in i18n.tsx prüft
-- diese Übersteuerung zuerst, dann das statische Wörterbuch, zuletzt Deutsch als Rückfall.
CREATE TABLE public.i18n_overrides (
  key text PRIMARY KEY,
  value_en text NOT NULL,
  value_en_source text, -- deutscher Text, aus dem die Übersetzung entstand (für "veraltet"-Erkennung)
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.i18n_overrides TO authenticated, anon;
GRANT ALL ON public.i18n_overrides TO service_role;
ALTER TABLE public.i18n_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "i18n overrides are publicly readable" ON public.i18n_overrides
  FOR SELECT USING (true);

CREATE POLICY "admin manages i18n overrides" ON public.i18n_overrides
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
