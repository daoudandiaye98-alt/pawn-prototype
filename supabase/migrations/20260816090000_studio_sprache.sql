-- Teil 25 (Das Studio spricht Englisch): gespeicherte Sprache je Haus, unabhängig von der
-- Browsersprache dessen, der gerade eine Aktion auslöst (Kunde bestellt, Admin greift ein, Cron
-- läuft). Steuert KI-Antworten im Studio und künftige designerseitige Systemmeldungen/E-Mails.
ALTER TABLE public.designers
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'de'
    CHECK (preferred_language IN ('de', 'en'));
