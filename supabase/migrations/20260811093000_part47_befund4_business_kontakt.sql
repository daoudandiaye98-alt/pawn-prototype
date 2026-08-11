-- PART 47 Befund 4 "Die Verlorenen": Instagram veröffentlicht bei Business-Accounts eigene
-- Kontaktfelder (Geschäfts-E-Mail, Telefon, Kategorie) über den eigenen Kontakt-Knopf — bislang
-- ungenutzt. Telefon/Kategorie brauchen eigene, idempotent angelegte Spalten (die Geschäfts-
-- E-Mail nutzt die bereits bestehende `email`-Spalte, nur `contact_source` unterscheidet die
-- Herkunft künftig als 'instagram_profil').
ALTER TABLE public.acquisition_leads
  ADD COLUMN IF NOT EXISTS business_phone text,
  ADD COLUMN IF NOT EXISTS business_category text;
