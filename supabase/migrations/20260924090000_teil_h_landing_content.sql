-- PAWN Finale Form Teil H — Landing-Korrektur: die UI-Selbstbeschreibung "Marktplatz" ist laut
-- Copy-Audit (Teil A3) abgelöst. Editable (src/components/palace/Editable.tsx) stellt den in der
-- DB gespeicherten Wert immer vor den JSX-Fallback im Code — ein reiner Code-Fix hätte den
-- bereits live gepflegten Text nicht verändert. Deshalb hier ausdrücklich per Migration
-- überschrieben (ON CONFLICT DO UPDATE), nicht nur geseedet.
INSERT INTO public.site_content (key, value, value_en) VALUES
  ('landing.cover_kicker', '"Der kuratierte Raum"'::jsonb, '"The curated space"'::jsonb),
  ('landing.from_houses_title', '"Aus den Häusern"'::jsonb, '"From the houses"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, value_en = EXCLUDED.value_en;
