-- Teil 13c: die eigentliche Ursache von "kein Video-Modell aktiv im Katalog".
-- ai_config erlaubte bisher nur Admins vollen Zugriff (ALL) plus einer einzigen
-- öffentlich lesbaren Ausnahme (key = 'matching_weights'). Jeder andere direkte
-- Lesezugriff aus dem Studio (model_catalog, tryon_provider, video_provider,
-- credit_costs, business_profile, ...) lief für Designer ins Leere — RLS blockte
-- still, ohne Fehler, sodass der Katalog im Frontend leer wirkte, obwohl er in
-- der DB befüllt war. Keine Secrets liegen in ai_config (die liegen als
-- Edge-Function-Envs) — reine Erweiterung, kein bestehender Constraint wird
-- verschärft oder entzogen.
CREATE POLICY "authenticated read ai_config" ON public.ai_config FOR SELECT TO authenticated
  USING (true);
