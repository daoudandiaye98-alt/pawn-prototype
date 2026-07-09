-- profiles.member_number
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS member_number bigint;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'profiles_member_number_seq') THEN
    CREATE SEQUENCE public.profiles_member_number_seq;
  END IF;
END $$;

WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY created_at NULLS LAST, id) AS rn
  FROM public.profiles WHERE member_number IS NULL
)
UPDATE public.profiles p
SET member_number = COALESCE((SELECT MAX(member_number) FROM public.profiles), 0) + o.rn
FROM ordered o WHERE p.id = o.id;

SELECT setval('public.profiles_member_number_seq', GREATEST(1, COALESCE((SELECT MAX(member_number) FROM public.profiles), 0)));

ALTER TABLE public.profiles ALTER COLUMN member_number SET DEFAULT nextval('public.profiles_member_number_seq');
CREATE UNIQUE INDEX IF NOT EXISTS profiles_member_number_uk ON public.profiles(member_number);

-- ai_config seeds
INSERT INTO public.ai_config (key, value)
VALUES ('platform_commission', jsonb_build_object('pct', 7, 'note', 'PAWN-Anteil je Verkauf'))
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.ai_config (key, value)
VALUES ('business_profile', jsonb_build_object(
  'account_holder', 'Daouda Ndiaye',
  'iban', 'LT54 3250 0034 7074 9792',
  'bic', 'REVOLT21',
  'email', 'pawnstudio.co@gmail.com',
  'instagram', 'hausofpawn',
  'tiktok', 'hausofpawn'
))
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.ai_config (key, value)
VALUES ('admin_help_topics', jsonb_build_object('topics', jsonb_build_array(
  jsonb_build_object('q', 'Was ist mein nächster Zug?', 'a', 'Ich zeige dir oben in der Übersicht die dringlichste offene Aufgabe — Bewerbungen, Posting-Queue oder fehlende Secrets.'),
  jsonb_build_object('q', 'Wie schalte ich Zahlungen scharf?', 'a', 'Du brauchst STRIPE_SECRET_KEY (Server-seitig) und ein hinterlegtes Auszahlungskonto. Beides steht in /admin/zahlungen.'),
  jsonb_build_object('q', 'Wer ist User X?', 'a', 'Ein internes Pseudonym, damit Kundendaten in Listen und Ereignissen anonym bleiben. Admins sehen den echten Namen als Zweitzeile.')
)))
ON CONFLICT (key) DO NOTHING;

-- Integration stubs with handle
INSERT INTO public.ai_integrations (kind, label, enabled, config, event_types)
SELECT 'instagram'::public.ai_integration_kind, 'PAWN Instagram', false,
       jsonb_build_object('handle','hausofpawn','note','Access-Token in Secrets ergänzen.'), ARRAY[]::text[]
WHERE NOT EXISTS (SELECT 1 FROM public.ai_integrations WHERE kind='instagram');

INSERT INTO public.ai_integrations (kind, label, enabled, config, event_types)
SELECT 'tiktok'::public.ai_integration_kind, 'PAWN TikTok', false,
       jsonb_build_object('handle','hausofpawn'), ARRAY[]::text[]
WHERE NOT EXISTS (SELECT 1 FROM public.ai_integrations WHERE kind='tiktok');

INSERT INTO public.ai_integrations (kind, label, enabled, config, event_types)
SELECT 'pinterest'::public.ai_integration_kind, 'PAWN Pinterest (bald)', false,
       jsonb_build_object('handle','hausofpawn','note','Stub — noch nicht aktiv.'), ARRAY[]::text[]
WHERE NOT EXISTS (SELECT 1 FROM public.ai_integrations WHERE kind='pinterest');
