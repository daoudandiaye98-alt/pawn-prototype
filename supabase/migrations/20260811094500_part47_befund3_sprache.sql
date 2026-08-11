-- PART 47 Befund 3 "Die Verlorenen": Spracherkennung verließ sich bislang allein auf ein
-- LLM-Urteil über den Bio-Text, mit Deutsch als Rückfall bei Unklarheit — d.oostingartist
-- (.nl-Domain, niederländische Bio) bekam so 'de'. Für den härteren, deterministischen Check
-- (Domain-Länder-Code vor Bio vor Profil-Standort) braucht es einen Ort für das schwächste der
-- drei Signale: den von Instagram angegebenen Profil-Standort, bislang gar nicht erfasst.
ALTER TABLE public.acquisition_leads
  ADD COLUMN IF NOT EXISTS profile_location text;
