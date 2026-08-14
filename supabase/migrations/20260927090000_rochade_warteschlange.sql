-- DIE LANGE ROCHADE — Schritt 1: Datenmodell und Warteschlange.
--
-- Ein Haus, das schon eine Website hat, soll sie nicht abtippen müssen. Der Import
-- läuft in Häppchen: eine Function holt sich ein paar offene Seiten oder Bilder,
-- arbeitet sie ab, ruft sich selbst wieder auf. Fällt sie mittendrin um, bleibt
-- der Stand stehen und der Aufräumer legt die hängengebliebenen Stücke zurück in
-- die Reihe. Jeder Schritt ist wiederaufnehmbar und darf doppelt laufen, ohne
-- doppelte Ergebnisse zu erzeugen — dafür sorgen die eindeutigen Schlüssel
-- (je Quell-URL bei Seiten und Bildern, je Werk-Schlüssel bei Kandidaten).
--
-- Vier Gesetze der Rochade, hier in der Datenform verankert:
--   1. Nichts geht live ohne die Auswahl der Designerin  → status 'uebernommen'
--      wird ausschließlich beim ausdrücklichen Übernehmen gesetzt.
--   2. Struktur schlägt Intelligenz → die rohen Plattformdaten (roh jsonb) stehen
--      vor der Deutung (deutung jsonb); beides getrennt gespeichert.
--   3. Importiert wird Identität, nie CSS → es gibt hier keine Spalte für Farben,
--      Schriften oder Layout. Absichtlich.
--   4. Nichts erfinden → alle inhaltlichen Felder sind nullable. Ein fehlender
--      Preis bleibt NULL und wird nie 0.
--
-- Keine parallele Welt: RLS-Muster, updated_at-Trigger und has_role() sind
-- dieselben wie bei generation_requests und den übrigen Auftragstabellen.

-- =========================================================================
-- 1) Der Auftrag — eine Rochade eines Hauses
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.rochade_auftraege (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id uuid NOT NULL REFERENCES public.designers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  quell_url text NOT NULL,
  quell_host text NOT NULL,
  plattform text NOT NULL DEFAULT 'unbekannt',

  -- 'neu' → 'laeuft' → 'fertig' (Lichttisch bereit) → 'uebernommen'
  -- Sackgassen: 'abgebrochen' (Nutzerin), 'fehler' (ehrlich gescheitert)
  -- 'zurueckgenommen' = die Übernahme wurde rückgängig gemacht (Schritt 7)
  status text NOT NULL DEFAULT 'neu'
    CHECK (status IN ('neu','laeuft','fertig','uebernommen','zurueckgenommen','abgebrochen','fehler')),
  -- Wo im Ablauf wir stehen — nur zum ehrlichen Anzeigen, nicht zum Steuern.
  phase text NOT NULL DEFAULT 'erkennen'
    CHECK (phase IN ('erkennen','sammeln','bilder','deuten','lichttisch','uebernehmen','fertig')),

  -- Einwilligung ist Pflicht und wird mit Herkunft, Zeit und Nutzerin protokolliert.
  -- Ohne sie wird nie geladen (Trigger unten erzwingt es).
  einwilligung_at timestamptz NOT NULL,
  einwilligung_quelle text NOT NULL DEFAULT 'studio',
  einwilligung_user uuid NOT NULL REFERENCES auth.users(id),

  -- Kontingente je Auftrag. Wird eines überschritten, hört der Lauf sauber auf
  -- und sagt es — er kürzt nie still.
  kontingent jsonb NOT NULL DEFAULT jsonb_build_object(
    'seiten', 120, 'werke', 300, 'bilder', 900, 'bytes', 400000000, 'ki_aufrufe', 40
  ),
  verbrauch jsonb NOT NULL DEFAULT jsonb_build_object(
    'seiten', 0, 'werke', 0, 'bilder', 0, 'bytes', 0, 'ki_aufrufe', 0
  ),
  kontingent_erreicht text,

  befund jsonb NOT NULL DEFAULT '{}'::jsonb,
  meldung text,
  fehler text,

  letzter_schritt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.rochade_auftraege IS
  'Lange Rochade: ein Import-Auftrag je Quell-Website und Haus. verbrauch/kontingent begrenzen den Lauf; einwilligung_* ist die protokollierte Zustimmung der Inhaberin.';
COMMENT ON COLUMN public.rochade_auftraege.kontingent_erreicht IS
  'Name des zuerst erschöpften Kontingents (seiten|werke|bilder|bytes|ki_aufrufe). Gesetzt heißt: sauber gestoppt, nicht gescheitert.';

CREATE INDEX IF NOT EXISTS rochade_auftraege_designer_idx
  ON public.rochade_auftraege (designer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rochade_auftraege_offen_idx
  ON public.rochade_auftraege (status, letzter_schritt_at) WHERE status IN ('neu','laeuft');
-- Ein Haus rochiert eine Quelle nur einmal gleichzeitig.
CREATE UNIQUE INDEX IF NOT EXISTS rochade_auftraege_einmal_offen_idx
  ON public.rochade_auftraege (designer_id, quell_host) WHERE status IN ('neu','laeuft');

-- =========================================================================
-- 2) Besuchte Seiten
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.rochade_seiten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auftrag_id uuid NOT NULL REFERENCES public.rochade_auftraege(id) ON DELETE CASCADE,

  url text NOT NULL,
  -- Normalisierte Adresse (ohne Fragment, ohne Tracking-Parameter, ohne Schrägstrich
  -- am Ende). Sie ist der Idempotenz-Schlüssel: dieselbe Seite wird nie zweimal geholt.
  url_schluessel text NOT NULL,
  art text NOT NULL DEFAULT 'seite'
    CHECK (art IN ('start','robots','sitemap','api','sammlung','werk','seite')),

  status text NOT NULL DEFAULT 'offen'
    CHECK (status IN ('offen','laeuft','fertig','fehler','uebersprungen')),
  http_status integer,
  versuche integer NOT NULL DEFAULT 0,
  fehler text,
  gefunden integer NOT NULL DEFAULT 0,

  begonnen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.rochade_seiten IS
  'Lange Rochade: jede Adresse, die für einen Auftrag angesehen wurde — mit eigenem Status. url_schluessel ist je Auftrag eindeutig, damit ein Neustart nichts doppelt lädt.';

CREATE UNIQUE INDEX IF NOT EXISTS rochade_seiten_schluessel_idx
  ON public.rochade_seiten (auftrag_id, url_schluessel);
CREATE INDEX IF NOT EXISTS rochade_seiten_offen_idx
  ON public.rochade_seiten (auftrag_id, status) WHERE status IN ('offen','laeuft');

-- =========================================================================
-- 3) Kandidaten — gefundene Werke, noch keine Werke
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.rochade_kandidaten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auftrag_id uuid NOT NULL REFERENCES public.rochade_auftraege(id) ON DELETE CASCADE,
  designer_id uuid NOT NULL REFERENCES public.designers(id) ON DELETE CASCADE,
  seite_id uuid REFERENCES public.rochade_seiten(id) ON DELETE SET NULL,

  quell_url text,
  -- Dubletten-Schlüssel aus Titel + Quell-Adresse (entdopple() im Adapter).
  schluessel text NOT NULL,

  -- Was in der Quelle stand. Fehlt etwas, bleibt es NULL — nie geraten.
  titel text,
  beschreibung_text text,
  preis_cent integer,
  waehrung text,
  verfuegbar boolean,
  varianten jsonb NOT NULL DEFAULT '[]'::jsonb,
  roh jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Was die Deutung daraus gemacht hat (Schritt 5). Getrennt von roh, damit man
  -- immer sieht, was Quelle war und was Vorschlag ist.
  welt text CHECK (welt IS NULL OR welt IN ('mode','interior','kunst')),
  angebotstyp text,
  welt_felder jsonb NOT NULL DEFAULT '{}'::jsonb,
  deutung jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Am Lichttisch sind alle vorausgewählt; Abwählen ist ein Tipp.
  gewaehlt boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'neu'
    CHECK (status IN ('neu','gedeutet','uebernommen','uebersprungen','fehler')),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,

  sortierung integer NOT NULL DEFAULT 0,
  fehler text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.rochade_kandidaten IS
  'Lange Rochade: ein gefundenes Werk, das noch keines ist. Wird erst durch das ausdrückliche Übernehmen der Designerin zu einem Eintrag in products (product_id).';
COMMENT ON COLUMN public.rochade_kandidaten.preis_cent IS
  'Preis in Cent oder NULL. NULL heißt: die Quelle nannte keinen Preis. Niemals 0 als Ersatz.';

CREATE UNIQUE INDEX IF NOT EXISTS rochade_kandidaten_schluessel_idx
  ON public.rochade_kandidaten (auftrag_id, schluessel);
CREATE INDEX IF NOT EXISTS rochade_kandidaten_auftrag_idx
  ON public.rochade_kandidaten (auftrag_id, sortierung);
CREATE INDEX IF NOT EXISTS rochade_kandidaten_offen_idx
  ON public.rochade_kandidaten (auftrag_id, status) WHERE status = 'neu';

-- =========================================================================
-- 4) Bilder
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.rochade_bilder (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auftrag_id uuid NOT NULL REFERENCES public.rochade_auftraege(id) ON DELETE CASCADE,
  kandidat_id uuid NOT NULL REFERENCES public.rochade_kandidaten(id) ON DELETE CASCADE,

  quell_url text NOT NULL,
  reihenfolge integer NOT NULL DEFAULT 0,

  status text NOT NULL DEFAULT 'offen'
    CHECK (status IN ('offen','laeuft','fertig','fehler','uebersprungen')),
  -- Inhalts-Hash der geladenen Datei: dasselbe Bild an zwei Adressen wird nur
  -- einmal gespeichert. Steht erst nach dem Laden fest.
  inhalt_hash text,
  -- Ort im Bucket designer-media, nie eine signierte URL: die läuft ab.
  -- Beim Anzeigen wird frisch signiert (src/lib/media.ts).
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

COMMENT ON TABLE public.rochade_bilder IS
  'Lange Rochade: ein Bild je Zeile mit eigenem Status. Ein gescheitertes Bild beendet nie den Auftrag — es bleibt als Zeile mit Grund stehen.';

CREATE UNIQUE INDEX IF NOT EXISTS rochade_bilder_quelle_idx
  ON public.rochade_bilder (auftrag_id, quell_url);
CREATE UNIQUE INDEX IF NOT EXISTS rochade_bilder_hash_idx
  ON public.rochade_bilder (auftrag_id, inhalt_hash) WHERE inhalt_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS rochade_bilder_kandidat_idx
  ON public.rochade_bilder (kandidat_id, reihenfolge);
CREATE INDEX IF NOT EXISTS rochade_bilder_offen_idx
  ON public.rochade_bilder (auftrag_id, status) WHERE status IN ('offen','laeuft');

-- =========================================================================
-- 5) updated_at — dasselbe Muster wie überall
-- =========================================================================

DROP TRIGGER IF EXISTS rochade_auftraege_touch ON public.rochade_auftraege;
CREATE TRIGGER rochade_auftraege_touch BEFORE UPDATE ON public.rochade_auftraege
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS rochade_seiten_touch ON public.rochade_seiten;
CREATE TRIGGER rochade_seiten_touch BEFORE UPDATE ON public.rochade_seiten
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS rochade_kandidaten_touch ON public.rochade_kandidaten;
CREATE TRIGGER rochade_kandidaten_touch BEFORE UPDATE ON public.rochade_kandidaten
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS rochade_bilder_touch ON public.rochade_bilder;
CREATE TRIGGER rochade_bilder_touch BEFORE UPDATE ON public.rochade_bilder
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Die Einwilligung darf nie nachträglich verschwinden oder in der Zukunft liegen.
CREATE OR REPLACE FUNCTION public.rochade_einwilligung_pruefen()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
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
CREATE TRIGGER rochade_auftraege_einwilligung
  BEFORE INSERT OR UPDATE ON public.rochade_auftraege
  FOR EACH ROW EXECUTE FUNCTION public.rochade_einwilligung_pruefen();

-- =========================================================================
-- 6) RLS — jedes Haus sieht nur sich, Admin sieht alles
-- =========================================================================

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

-- Auftrag
DROP POLICY IF EXISTS "haus sieht eigene rochade" ON public.rochade_auftraege;
CREATE POLICY "haus sieht eigene rochade" ON public.rochade_auftraege
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.designers d
                 WHERE d.id = rochade_auftraege.designer_id AND d.user_id = auth.uid()));
DROP POLICY IF EXISTS "haus startet eigene rochade" ON public.rochade_auftraege;
CREATE POLICY "haus startet eigene rochade" ON public.rochade_auftraege
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()
              AND einwilligung_user = auth.uid()
              AND EXISTS (SELECT 1 FROM public.designers d
                          WHERE d.id = designer_id AND d.user_id = auth.uid()));
DROP POLICY IF EXISTS "haus lenkt eigene rochade" ON public.rochade_auftraege;
CREATE POLICY "haus lenkt eigene rochade" ON public.rochade_auftraege
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.designers d
                 WHERE d.id = rochade_auftraege.designer_id AND d.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.designers d
                      WHERE d.id = rochade_auftraege.designer_id AND d.user_id = auth.uid()));
DROP POLICY IF EXISTS "haus verwirft eigene rochade" ON public.rochade_auftraege;
CREATE POLICY "haus verwirft eigene rochade" ON public.rochade_auftraege
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.designers d
                 WHERE d.id = rochade_auftraege.designer_id AND d.user_id = auth.uid()));
DROP POLICY IF EXISTS "admin sieht alle rochaden" ON public.rochade_auftraege;
CREATE POLICY "admin sieht alle rochaden" ON public.rochade_auftraege
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seiten, Kandidaten, Bilder hängen am Auftrag.
DROP POLICY IF EXISTS "haus sieht eigene rochade-seiten" ON public.rochade_seiten;
CREATE POLICY "haus sieht eigene rochade-seiten" ON public.rochade_seiten
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rochade_auftraege a JOIN public.designers d ON d.id = a.designer_id
                 WHERE a.id = rochade_seiten.auftrag_id AND d.user_id = auth.uid()));
DROP POLICY IF EXISTS "admin alle rochade-seiten" ON public.rochade_seiten;
CREATE POLICY "admin alle rochade-seiten" ON public.rochade_seiten
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "haus sieht eigene kandidaten" ON public.rochade_kandidaten;
CREATE POLICY "haus sieht eigene kandidaten" ON public.rochade_kandidaten
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.designers d
                 WHERE d.id = rochade_kandidaten.designer_id AND d.user_id = auth.uid()));
-- Auswählen und Abwählen am Lichttisch ist das eine, was die Designerin selbst schreibt.
DROP POLICY IF EXISTS "haus waehlt eigene kandidaten" ON public.rochade_kandidaten;
CREATE POLICY "haus waehlt eigene kandidaten" ON public.rochade_kandidaten
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.designers d
                 WHERE d.id = rochade_kandidaten.designer_id AND d.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.designers d
                      WHERE d.id = rochade_kandidaten.designer_id AND d.user_id = auth.uid()));
DROP POLICY IF EXISTS "admin alle kandidaten" ON public.rochade_kandidaten;
CREATE POLICY "admin alle kandidaten" ON public.rochade_kandidaten
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "haus sieht eigene rochade-bilder" ON public.rochade_bilder;
CREATE POLICY "haus sieht eigene rochade-bilder" ON public.rochade_bilder
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rochade_auftraege a JOIN public.designers d ON d.id = a.designer_id
                 WHERE a.id = rochade_bilder.auftrag_id AND d.user_id = auth.uid()));
DROP POLICY IF EXISTS "admin alle rochade-bilder" ON public.rochade_bilder;
CREATE POLICY "admin alle rochade-bilder" ON public.rochade_bilder
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- 7) Die Warteschlange — Häppchen holen, Kontingent buchen, aufräumen
-- =========================================================================

-- Holt sich atomar die nächsten offenen Seiten und markiert sie als laufend.
-- SKIP LOCKED: zwei gleichzeitige Selbstaufrufe greifen nie nach demselben Stück.
CREATE OR REPLACE FUNCTION public.rochade_seiten_holen(p_auftrag uuid, p_anzahl integer DEFAULT 5)
RETURNS SETOF public.rochade_seiten
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
RETURNS SETOF public.rochade_bilder
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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

-- Bucht Verbrauch auf ein Kontingent. Gibt zurück, ob der Lauf weitergehen darf.
-- Atomar, damit parallele Häppchen das Kontingent nicht gemeinsam überziehen.
CREATE OR REPLACE FUNCTION public.rochade_kontingent_buchen(
  p_auftrag uuid, p_feld text, p_menge bigint DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  neu bigint;
  grenze bigint;
BEGIN
  IF p_feld NOT IN ('seiten','werke','bilder','bytes','ki_aufrufe') THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'unbekanntes_kontingent');
  END IF;

  UPDATE public.rochade_auftraege
     SET verbrauch = jsonb_set(
           verbrauch, ARRAY[p_feld],
           to_jsonb(COALESCE((verbrauch ->> p_feld)::bigint, 0) + p_menge)
         ),
         letzter_schritt_at = now()
   WHERE id = p_auftrag
  RETURNING COALESCE((verbrauch ->> p_feld)::bigint, 0),
            COALESCE((kontingent ->> p_feld)::bigint, 0)
    INTO neu, grenze;

  IF neu IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'auftrag_unbekannt');
  END IF;

  IF grenze > 0 AND neu >= grenze THEN
    -- Sauber anhalten und es sagen — nie still kürzen.
    UPDATE public.rochade_auftraege
       SET kontingent_erreicht = COALESCE(kontingent_erreicht, p_feld)
     WHERE id = p_auftrag;
    RETURN jsonb_build_object('ok', false, 'grund', 'kontingent', 'feld', p_feld,
                              'stand', neu, 'grenze', grenze);
  END IF;

  RETURN jsonb_build_object('ok', true, 'feld', p_feld, 'stand', neu, 'grenze', grenze);
END;
$$;

-- Der Aufräumer: legt hängengebliebene Stücke zurück in die Reihe. Nach drei
-- Versuchen bleibt ein Stück als Fehler stehen — mit Grund, damit man es sieht.
CREATE OR REPLACE FUNCTION public.rochade_aufraeumen()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seiten_zurueck integer := 0;
  bilder_zurueck integer := 0;
  seiten_auf integer := 0;
  bilder_auf integer := 0;
  auftraege_still integer := 0;
BEGIN
  WITH zurueck AS (
    UPDATE public.rochade_seiten
       SET status = 'offen'
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
    UPDATE public.rochade_bilder
       SET status = 'offen'
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

  -- Aufträge, an denen seit einer Stunde nichts mehr passiert ist und die nichts
  -- Offenes mehr haben, sind fertig. Der Lichttisch kann aufmachen.
  WITH still AS (
    UPDATE public.rochade_auftraege a
       SET status = 'fertig', phase = 'lichttisch'
     WHERE a.status = 'laeuft'
       AND a.letzter_schritt_at < now() - interval '1 hour'
       AND NOT EXISTS (SELECT 1 FROM public.rochade_seiten s
                        WHERE s.auftrag_id = a.id AND s.status IN ('offen','laeuft'))
       AND NOT EXISTS (SELECT 1 FROM public.rochade_bilder b
                        WHERE b.auftrag_id = a.id AND b.status IN ('offen','laeuft'))
    RETURNING 1
  ) SELECT count(*) INTO auftraege_still FROM still;

  RETURN jsonb_build_object(
    'seiten_zurueck', seiten_zurueck, 'seiten_aufgegeben', seiten_auf,
    'bilder_zurueck', bilder_zurueck, 'bilder_aufgegeben', bilder_auf,
    'auftraege_abgeschlossen', auftraege_still
  );
END;
$$;

-- Der Stand eines Auftrags in einer Zeile — für den Lichttisch und die
-- Fortschrittsanzeige, ohne vier Abfragen aus dem Browser.
CREATE OR REPLACE FUNCTION public.rochade_stand(p_auftrag uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
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

-- =========================================================================
-- 8) Cron-Aufräumer — dasselbe Muster wie compute-trends-daily,
--    nur ohne HTTP: es ist reine Datenbankarbeit.
-- =========================================================================

DO $$ BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'rochade-aufraeumen';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  PERFORM cron.schedule('rochade-aufraeumen', '*/10 * * * *', 'SELECT public.rochade_aufraeumen();');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron nicht verfügbar — rochade_aufraeumen() muss anders getaktet werden.';
END $$;
