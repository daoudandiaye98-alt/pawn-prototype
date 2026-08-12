-- PAWN Finale Form Teil I — Visions-Seite korrigiert: Kicker-Text geändert ("PAWNs Vision" ->
-- "Die Vision"), die Kette bekommt eigene, admin-editierbare Zeilen statt eines hartcodierten
-- Arrays, die Haltung wird ebenfalls admin-editierbar, plus der eine neue CTA "Mach deinen Zug".
-- Editable (src/components/palace/Editable.tsx) priorisiert immer den DB-Wert vor dem JSX-Fallback
-- im Code — deshalb hier per Migration gesetzt (ON CONFLICT DO UPDATE für den bereits live
-- gepflegten Kicker), nicht nur im Code-Fallback geändert.
INSERT INTO public.site_content (key, value, value_en) VALUES
  ('vision_kicker', '"Die Vision"'::jsonb, '"The Vision"'::jsonb),
  ('vision_kette_talent', '"Talent"'::jsonb, '"Talent"'::jsonb),
  ('vision_kette_ausdruck', '"Ausdruck"'::jsonb, '"Expression"'::jsonb),
  ('vision_kette_sichtbarkeit', '"Sichtbarkeit"'::jsonb, '"Visibility"'::jsonb),
  ('vision_kette_bewegung', '"Bewegung"'::jsonb, '"Movement"'::jsonb),
  ('vision_kette_identitaet', '"Identität"'::jsonb, '"Identity"'::jsonb),
  ('vision_kette_transformation', '"Transformation"'::jsonb, '"Transformation"'::jsonb),
  ('vision_haltung', '"PAWN sagt nie: Wir machen dich zum Künstler. PAWN sagt: Du bist dran."'::jsonb, '"PAWN never says: we''ll make you an artist. PAWN says: your move."'::jsonb),
  ('vision_cta', '"Mach deinen Zug"'::jsonb, '"Make your move"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, value_en = EXCLUDED.value_en;
