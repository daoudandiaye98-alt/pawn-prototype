-- lovable-cron-fallback-reviewed: 144 runs/day; haengengebliebene Import-Haeppchen muessen binnen 10 Minuten zurueck in die Warteschlange, sonst steht der Import der Designerin still
CREATE TABLE IF NOT EXISTS public.rochade_auftraege (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id uuid NOT NULL REFERENCES public.designers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quell_url text NOT NULL,
  quell_host text NOT NULL,
  plattform text NOT NULL DEFAULT 'unbekannt',
  status text NOT NULL DEFAULT 'neu'
    CHECK (status IN ('neu','laeuft','fertig','uebernommen','zurueckgenommen','abgebrochen','fehler')),
  phase text NOT NULL DEFAULT 'erkennen'
    CHECK (phase IN ('erkennen','sammeln','bilder','deuten','lichttisch','uebernehmen','fertig')),
  einwilligung_at timestamptz NOT NULL,
  einwilligung_quelle text NOT NULL DEFAULT 'studio',
  einwilligung_user uuid NOT NULL REFERENCES auth.users(id),
  kontingent jsonb NOT NULL DEFAULT jsonb_build_object('seiten', 120, 'werke', 300, 'bilder', 900, 'bytes', 400000000, 'ki_aufrufe', 40),
  verbrauch jsonb NOT NULL DEFAULT jsonb_build_object('seiten', 0, 'werke', 0, 'bilder', 0, 'bytes', 0, 'ki_aufrufe', 0),
  kontingent_erreicht text,
  befund jsonb NOT NULL DEFAULT '{}'::jsonb,
  meldung text,
  fehler text,
  letzter_schritt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rochade_auftraege_designer_idx ON public.rochade_auftraege (designer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rochade_auftraege_offen_idx ON public.rochade_auftraege (status, letzter_schritt_at) WHERE status IN ('neu','laeuft');
CREATE UNIQUE INDEX IF NOT EXISTS rochade_auftraege_einmal_offen_idx ON public.rochade_auftraege (designer_id, quell_host) WHERE status IN ('neu','laeuft');

CREATE TABLE IF NOT EXISTS public.rochade_seiten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auftrag_id uuid NOT NULL REFERENCES public.rochade_auftraege(id) ON DELETE CASCADE,
  url text NOT NULL,
  url_schluessel text NOT NULL,
  art text NOT NULL DEFAULT 'seite' CHECK (art IN ('start','robots','sitemap','api','sammlung','werk','seite')),
  status text NOT NULL DEFAULT 'offen' CHECK (status IN ('offen','laeuft','fertig','fehler','uebersprungen')),
  http_status integer,
  versuche integer NOT NULL DEFAULT 0,
  fehler text,
  gefunden integer NOT NULL DEFAULT 0,
  begonnen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rochade_seiten_schluessel_idx ON public.rochade_seiten (auftrag_id, url_schluessel);
CREATE INDEX IF NOT EXISTS rochade_seiten_offen_idx ON public.rochade_seiten (auftrag_id, status) WHERE status IN ('offen','laeuft');

CREATE TABLE IF NOT EXISTS public.rochade_kandidaten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auftrag_id uuid NOT NULL REFERENCES public.rochade_auftraege(id) ON DELETE CASCADE,
  designer_id uuid NOT NULL REFERENCES public.designers(id) ON DELETE CASCADE,
  seite_id uuid REFERENCES public.rochade_seiten(id) ON DELETE SET NULL,
  quell_url text,
  schluessel text NOT NULL,
  titel text,
  beschreibung_text text,
  preis_cent integer,
  waehrung text,
  verfuegbar boolean,
  varianten jsonb NOT NULL DEFAULT '[]'::jsonb,
  roh jsonb NOT NULL DEFAULT '{}'::jsonb,
  welt text CHECK (welt IS NULL OR welt IN ('mode','interior','kunst')),
  angebotstyp text,
  welt_felder jsonb NOT NULL DEFAULT '{}'::jsonb,
  deutung jsonb NOT NULL DEFAULT '{}'::jsonb,
  gewaehlt boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'neu' CHECK (status IN ('neu','gedeutet','uebernommen','uebersprungen','fehler')),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  sortierung integer NOT NULL DEFAULT 0,
  fehler text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rochade_kandidaten_schluessel_idx ON public.rochade_kandidaten (auftrag_id, schluessel);
CREATE INDEX IF NOT EXISTS rochade_kandidaten_auftrag_idx ON public.rochade_kandidaten (auftrag_id, sortierung);
CREATE INDEX IF NOT EXISTS rochade_kandidaten_offen_idx ON public.rochade_kandidaten (auftrag_id, status) WHERE status = 'neu';

CREATE TABLE IF NOT EXISTS public.rochade_bilder (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auftrag_id uuid NOT NULL REFERENCES public.rochade_auftraege(id) ON DELETE CASCADE,
  kandidat_id uuid NOT NULL REFERENCES public.rochade_kandidaten(id) ON DELETE CASCADE,
  quell_url text NOT NULL,
  reihenfolge integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'offen' CHECK (status IN ('offen','laeuft','fertig','fehler','uebersprungen')),
  inhalt_hash text,
  pfad text,
  pfad_klein text,
  breite integer,
  hoehe integer,
  bytes integer,
  versuche integer NOT NULL DEFAULT 0,
  fehler text,
  begonnen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rochade_bilder_quelle_idx ON public.rochade_bilder (auftrag_id, quell_url);
CREATE UNIQUE INDEX IF NOT EXISTS rochade_bilder_hash_idx ON public.rochade_bilder (auftrag_id, inhalt_hash) WHERE inhalt_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS rochade_bilder_kandidat_idx ON public.rochade_bilder (kandidat_id, reihenfolge);
CREATE INDEX IF NOT EXISTS rochade_bilder_offen_idx ON public.rochade_bilder (auftrag_id, status) WHERE status IN ('offen','laeuft');

DROP TRIGGER IF EXISTS rochade_auftraege_touch ON public.rochade_auftraege;
CREATE TRIGGER rochade_auftraege_touch BEFORE UPDATE ON public.rochade_auftraege FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS rochade_seiten_touch ON public.rochade_seiten;
CREATE TRIGGER rochade_seiten_touch BEFORE UPDATE ON public.rochade_seiten FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS rochade_kandidaten_touch ON public.rochade_kandidaten;
CREATE TRIGGER rochade_kandidaten_touch BEFORE UPDATE ON public.rochade_kandidaten FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS rochade_bilder_touch ON public.rochade_bilder;
CREATE TRIGGER rochade_bilder_touch BEFORE UPDATE ON public.rochade_bilder FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.rochade_einwilligung_pruefen()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.einwilligung_at IS NULL OR NEW.einwilligung_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Rochade ohne gültige Einwilligung der Inhaberin ist nicht möglich.';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.einwilligung_at IS DISTINCT FROM NEW.einwilligung_at THEN
    RAISE EXCEPTION 'Die protokollierte Einwilligung wird nicht nachträglich geändert.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rochade_auftraege_einwilligung ON public.rochade_auftraege;
CREATE TRIGGER rochade_auftraege_einwilligung BEFORE INSERT OR UPDATE ON public.rochade_auftraege
  FOR EACH ROW EXECUTE FUNCTION public.rochade_einwilligung_pruefen();

ALTER TABLE public.rochade_auftraege  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rochade_seiten     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rochade_kandidaten ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rochade_bilder     ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rochade_auftraege  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rochade_seiten     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rochade_kandidaten TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rochade_bilder     TO authenticated;
GRANT ALL ON public.rochade_auftraege  TO service_role;
GRANT ALL ON public.rochade_seiten     TO service_role;
GRANT ALL ON public.rochade_kandidaten TO service_role;
GRANT ALL ON public.rochade_bilder     TO service_role;

DROP POLICY IF EXISTS "haus sieht eigene rochade" ON public.rochade_auftraege;
CREATE POLICY "haus sieht eigene rochade" ON public.rochade_auftraege
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.designers d WHERE d.id = rochade_auftraege.designer_id AND d.user_id = auth.uid()));
DROP POLICY IF EXISTS "haus startet eigene rochade" ON public.rochade_auftraege;
CREATE POLICY "haus startet eigene rochade" ON public.rochade_auftraege
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND einwilligung_user = auth.uid()
              AND EXISTS (SELECT 1 FROM public.designers d WHERE d.id = designer_id AND d.user_id = auth.uid()));
DROP POLICY IF EXISTS "haus lenkt eigene rochade" ON public.rochade_auftraege;
CREATE POLICY "haus lenkt eigene rochade" ON public.rochade_auftraege
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.designers d WHERE d.id = rochade_auftraege.designer_id AND d.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.designers d WHERE d.id = rochade_auftraege.designer_id AND d.user_id = auth.uid()));
DROP POLICY IF EXISTS "haus verwirft eigene rochade" ON public.rochade_auftraege;
CREATE POLICY "haus verwirft eigene rochade" ON public.rochade_auftraege
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.designers d WHERE d.id = rochade_auftraege.designer_id AND d.user_id = auth.uid()));
DROP POLICY IF EXISTS "admin sieht alle rochaden" ON public.rochade_auftraege;
CREATE POLICY "admin sieht alle rochaden" ON public.rochade_auftraege
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "haus sieht eigene rochade-seiten" ON public.rochade_seiten;
CREATE POLICY "haus sieht eigene rochade-seiten" ON public.rochade_seiten
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rochade_auftraege a JOIN public.designers d ON d.id = a.designer_id
                 WHERE a.id = rochade_seiten.auftrag_id AND d.user_id = auth.uid()));
DROP POLICY IF EXISTS "admin alle rochade-seiten" ON public.rochade_seiten;
CREATE POLICY "admin alle rochade-seiten" ON public.rochade_seiten
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "haus sieht eigene kandidaten" ON public.rochade_kandidaten;
CREATE POLICY "haus sieht eigene kandidaten" ON public.rochade_kandidaten
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.designers d WHERE d.id = rochade_kandidaten.designer_id AND d.user_id = auth.uid()));
DROP POLICY IF EXISTS "haus waehlt eigene kandidaten" ON public.rochade_kandidaten;
CREATE POLICY "haus waehlt eigene kandidaten" ON public.rochade_kandidaten
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.designers d WHERE d.id = rochade_kandidaten.designer_id AND d.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.designers d WHERE d.id = rochade_kandidaten.designer_id AND d.user_id = auth.uid()));
DROP POLICY IF EXISTS "admin alle kandidaten" ON public.rochade_kandidaten;
CREATE POLICY "admin alle kandidaten" ON public.rochade_kandidaten
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "haus sieht eigene rochade-bilder" ON public.rochade_bilder;
CREATE POLICY "haus sieht eigene rochade-bilder" ON public.rochade_bilder
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rochade_auftraege a JOIN public.designers d ON d.id = a.designer_id
                 WHERE a.id = rochade_bilder.auftrag_id AND d.user_id = auth.uid()));
DROP POLICY IF EXISTS "admin alle rochade-bilder" ON public.rochade_bilder;
CREATE POLICY "admin alle rochade-bilder" ON public.rochade_bilder
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.rochade_seiten_holen(p_auftrag uuid, p_anzahl integer DEFAULT 5)
RETURNS SETOF public.rochade_seiten LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.rochade_seiten s
     SET status = 'laeuft', versuche = s.versuche + 1, begonnen_at = now()
   WHERE s.id IN (
     SELECT id FROM public.rochade_seiten
      WHERE auftrag_id = p_auftrag AND status = 'offen'
      ORDER BY created_at
      LIMIT greatest(1, least(p_anzahl, 25))
      FOR UPDATE SKIP LOCKED
   )
  RETURNING s.*;
$$;

CREATE OR REPLACE FUNCTION public.rochade_bilder_holen(p_auftrag uuid, p_anzahl integer DEFAULT 5)
RETURNS SETOF public.rochade_bilder LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.rochade_bilder b
     SET status = 'laeuft', versuche = b.versuche + 1, begonnen_at = now()
   WHERE b.id IN (
     SELECT id FROM public.rochade_bilder
      WHERE auftrag_id = p_auftrag AND status = 'offen'
      ORDER BY reihenfolge, created_at
      LIMIT greatest(1, least(p_anzahl, 25))
      FOR UPDATE SKIP LOCKED
   )
  RETURNING b.*;
$$;

CREATE OR REPLACE FUNCTION public.rochade_kontingent_buchen(p_auftrag uuid, p_feld text, p_menge bigint DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  neu bigint;
  grenze bigint;
BEGIN
  IF p_feld NOT IN ('seiten','werke','bilder','bytes','ki_aufrufe') THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'unbekanntes_kontingent');
  END IF;

  UPDATE public.rochade_auftraege
     SET verbrauch = jsonb_set(verbrauch, ARRAY[p_feld], to_jsonb(COALESCE((verbrauch ->> p_feld)::bigint, 0) + p_menge)),
         letzter_schritt_at = now()
   WHERE id = p_auftrag
  RETURNING COALESCE((verbrauch ->> p_feld)::bigint, 0), COALESCE((kontingent ->> p_feld)::bigint, 0)
    INTO neu, grenze;

  IF neu IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'auftrag_unbekannt');
  END IF;

  IF grenze > 0 AND neu >= grenze THEN
    UPDATE public.rochade_auftraege SET kontingent_erreicht = COALESCE(kontingent_erreicht, p_feld) WHERE id = p_auftrag;
    RETURN jsonb_build_object('ok', false, 'grund', 'kontingent', 'feld', p_feld, 'stand', neu, 'grenze', grenze);
  END IF;

  RETURN jsonb_build_object('ok', true, 'feld', p_feld, 'stand', neu, 'grenze', grenze);
END;
$$;

CREATE OR REPLACE FUNCTION public.rochade_aufraeumen()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  seiten_zurueck integer := 0;
  bilder_zurueck integer := 0;
  seiten_auf integer := 0;
  bilder_auf integer := 0;
  auftraege_still integer := 0;
BEGIN
  WITH zurueck AS (
    UPDATE public.rochade_seiten SET status = 'offen'
     WHERE status = 'laeuft' AND begonnen_at < now() - interval '10 minutes' AND versuche < 3
    RETURNING 1
  ) SELECT count(*) INTO seiten_zurueck FROM zurueck;

  WITH aufgeben AS (
    UPDATE public.rochade_seiten
       SET status = 'fehler',
           fehler = COALESCE(fehler, 'Diese Seite hat dreimal nicht geantwortet. Der Rest des Imports läuft weiter.')
     WHERE status = 'laeuft' AND begonnen_at < now() - interval '10 minutes' AND versuche >= 3
    RETURNING 1
  ) SELECT count(*) INTO seiten_auf FROM aufgeben;

  WITH zurueck AS (
    UPDATE public.rochade_bilder SET status = 'offen'
     WHERE status = 'laeuft' AND begonnen_at < now() - interval '10 minutes' AND versuche < 3
    RETURNING 1
  ) SELECT count(*) INTO bilder_zurueck FROM zurueck;

  WITH aufgeben AS (
    UPDATE public.rochade_bilder
       SET status = 'fehler',
           fehler = COALESCE(fehler, 'Dieses Bild ließ sich dreimal nicht laden. Die übrigen Bilder sind da.')
     WHERE status = 'laeuft' AND begonnen_at < now() - interval '10 minutes' AND versuche >= 3
    RETURNING 1
  ) SELECT count(*) INTO bilder_auf FROM aufgeben;

  WITH still AS (
    UPDATE public.rochade_auftraege a
       SET status = 'fertig', phase = 'lichttisch'
     WHERE a.status = 'laeuft'
       AND a.letzter_schritt_at < now() - interval '1 hour'
       AND NOT EXISTS (SELECT 1 FROM public.rochade_seiten s WHERE s.auftrag_id = a.id AND s.status IN ('offen','laeuft'))
       AND NOT EXISTS (SELECT 1 FROM public.rochade_bilder b WHERE b.auftrag_id = a.id AND b.status IN ('offen','laeuft'))
    RETURNING 1
  ) SELECT count(*) INTO auftraege_still FROM still;

  RETURN jsonb_build_object(
    'seiten_zurueck', seiten_zurueck, 'seiten_aufgegeben', seiten_auf,
    'bilder_zurueck', bilder_zurueck, 'bilder_aufgegeben', bilder_auf,
    'auftraege_abgeschlossen', auftraege_still
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rochade_stand(p_auftrag uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'auftrag_id', a.id,
    'status', a.status,
    'phase', a.phase,
    'plattform', a.plattform,
    'kontingent_erreicht', a.kontingent_erreicht,
    'meldung', a.meldung,
    'seiten_offen',  (SELECT count(*) FROM public.rochade_seiten s WHERE s.auftrag_id = a.id AND s.status IN ('offen','laeuft')),
    'seiten_fertig', (SELECT count(*) FROM public.rochade_seiten s WHERE s.auftrag_id = a.id AND s.status = 'fertig'),
    'seiten_fehler', (SELECT count(*) FROM public.rochade_seiten s WHERE s.auftrag_id = a.id AND s.status = 'fehler'),
    'werke',         (SELECT count(*) FROM public.rochade_kandidaten k WHERE k.auftrag_id = a.id),
    'werke_gewaehlt',(SELECT count(*) FROM public.rochade_kandidaten k WHERE k.auftrag_id = a.id AND k.gewaehlt),
    'werke_ohne_preis', (SELECT count(*) FROM public.rochade_kandidaten k WHERE k.auftrag_id = a.id AND k.preis_cent IS NULL),
    'bilder_offen',  (SELECT count(*) FROM public.rochade_bilder b WHERE b.auftrag_id = a.id AND b.status IN ('offen','laeuft')),
    'bilder_fertig', (SELECT count(*) FROM public.rochade_bilder b WHERE b.auftrag_id = a.id AND b.status = 'fertig'),
    'bilder_fehler', (SELECT count(*) FROM public.rochade_bilder b WHERE b.auftrag_id = a.id AND b.status = 'fehler')
  )
  FROM public.rochade_auftraege a
  WHERE a.id = p_auftrag;
$$;

REVOKE ALL ON FUNCTION public.rochade_seiten_holen(uuid, integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.rochade_bilder_holen(uuid, integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.rochade_kontingent_buchen(uuid, text, bigint) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.rochade_aufraeumen() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rochade_seiten_holen(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.rochade_bilder_holen(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.rochade_kontingent_buchen(uuid, text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.rochade_aufraeumen() TO service_role;
GRANT EXECUTE ON FUNCTION public.rochade_stand(uuid) TO authenticated, service_role;

DO $$ BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'rochade-aufraeumen';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  PERFORM cron.schedule('rochade-aufraeumen', '*/10 * * * *', 'SELECT public.rochade_aufraeumen();');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron nicht verfügbar';
END $$;