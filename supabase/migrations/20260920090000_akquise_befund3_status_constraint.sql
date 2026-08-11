-- AUFTRAG "KEINE ANNAHME OHNE BELEG" — Befund 3: der Status-Constraint auf acquisition_leads
-- wurde bisher nur manuell in der Live-Datenbank erweitert (um 'geantwortet', 'beworben',
-- 'gewonnen'), damit die Antworterfassung aus PART 47 überhaupt speicherbar war. Diese Änderung
-- existierte bisher nirgends im Repo — hier nachgezogen, idempotent (DROP IF EXISTS davor).
--
-- Repo-weite Prüfung (grep über supabase/functions + src) ergab einen weiteren, in der
-- Auftragsvorlage fehlenden Wert: 'abgemeldet' wird tatsächlich geschrieben, und zwar an zwei
-- Stellen — akquise-abmelden/index.ts (UWG §7 Ein-Klick-Abmeldung ohne Login) und
-- resend-webhook/index.ts (harter Bounce/Beschwerde → automatischer Opt-out). Ohne diesen Wert
-- im Constraint hätten beide E-Mail-Compliance-Pfade seit ihrer Einführung (Teil 39 AP4) bei
-- jedem Aufruf mit einem Datenbankfehler abgebrochen — derselbe stille Fehler wie bei
-- 'geantwortet' zuvor, hier vor dem ersten echten Vorfall gefangen statt danach.
ALTER TABLE public.acquisition_leads DROP CONSTRAINT IF EXISTS acquisition_leads_status_check;
ALTER TABLE public.acquisition_leads ADD CONSTRAINT acquisition_leads_status_check
  CHECK (status = ANY (ARRAY['neu','angewaermt','kontaktiert','antwort','registriert','aktiviert',
    'spaeter','nein','ghost','qualifiziert','aussortiert','ruhe','geantwortet','beworben','gewonnen',
    'abgemeldet']));
