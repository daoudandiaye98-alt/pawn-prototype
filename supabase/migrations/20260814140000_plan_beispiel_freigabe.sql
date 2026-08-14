-- Fix Plan-Beispiele: nur mit ausdrücklicher Freigabe, nie automatisch.
--
-- Befund: die Plan-Karten (/studio/plan) zogen sich ihr Beispiel selbst aus dem
-- Bestand — „irgendein Werk eines Hauses dieser Stufe". Beim einzigen heute
-- existierenden Haus bedeutete das: ein Testartikel landete als Maison-Beispiel
-- auf der Plan-Seite. Die Regel bleibt richtig, sie darf nur nie von selbst feuern.
--
-- Ab jetzt: ein Werk ist Plan-Beispiel genau dann, wenn ein Admin es ausdrücklich
-- für eine Stufe freigegeben hat. Kein Ersatz aus dem Bestand, keine Heuristik.

-- 1) Das Freigabe-Feld am Werk. Default leer = kein Beispiel.
ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS plan_beispiel text
  CHECK (plan_beispiel IS NULL OR plan_beispiel IN ('haus', 'atelier', 'maison'));

ALTER TABLE public.video_assets
  ADD COLUMN IF NOT EXISTS plan_beispiel text
  CHECK (plan_beispiel IS NULL OR plan_beispiel IN ('haus', 'atelier', 'maison'));

CREATE INDEX IF NOT EXISTS media_assets_plan_beispiel_idx
  ON public.media_assets (plan_beispiel) WHERE plan_beispiel IS NOT NULL;
CREATE INDEX IF NOT EXISTS video_assets_plan_beispiel_idx
  ON public.video_assets (plan_beispiel) WHERE plan_beispiel IS NOT NULL;

-- 2) Interne Häuser (Test, Demo, PAWN-eigen) sind von Plan-Beispielen generell
--    ausgeschlossen. Bisher gab es dafür kein Merkmal — hier ist es.
ALTER TABLE public.designers
  ADD COLUMN IF NOT EXISTS intern boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.designers.intern IS
  'Test-/Demo-/PAWN-eigenes Haus. Solche Häuser liefern nie Plan-Beispiele.';

-- Bestand: jedes Haus, das einem Admin gehört, gilt ab sofort als intern.
UPDATE public.designers d
SET intern = true
WHERE NOT d.intern
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = d.user_id AND ur.role = 'admin'
  );

-- Neu angelegte Häuser eines Admins starten ebenfalls als intern.
CREATE OR REPLACE FUNCTION public.designer_intern_bei_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = NEW.user_id AND ur.role = 'admin'
  ) THEN
    NEW.intern := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS designer_intern_bei_admin_trg ON public.designers;
CREATE TRIGGER designer_intern_bei_admin_trg
  BEFORE INSERT ON public.designers
  FOR EACH ROW EXECUTE FUNCTION public.designer_intern_bei_admin();

-- 3) Die Sperre gilt in der Datenbank, nicht nur in der Oberfläche: ein Werk eines
--    internen Hauses lässt sich gar nicht erst als Plan-Beispiel freigeben.
CREATE OR REPLACE FUNCTION public.plan_beispiel_nur_echte_haeuser()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.plan_beispiel IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.designers d
    WHERE d.id = NEW.designer_id AND d.intern
  ) THEN
    RAISE EXCEPTION 'Interne Häuser (Test/Demo/PAWN-eigen) können keine Plan-Beispiele stellen.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS media_assets_plan_beispiel_trg ON public.media_assets;
CREATE TRIGGER media_assets_plan_beispiel_trg
  BEFORE INSERT OR UPDATE OF plan_beispiel ON public.media_assets
  FOR EACH ROW EXECUTE FUNCTION public.plan_beispiel_nur_echte_haeuser();

DROP TRIGGER IF EXISTS video_assets_plan_beispiel_trg ON public.video_assets;
CREATE TRIGGER video_assets_plan_beispiel_trg
  BEFORE INSERT OR UPDATE OF plan_beispiel ON public.video_assets
  FOR EACH ROW EXECUTE FUNCTION public.plan_beispiel_nur_echte_haeuser();

-- 4) Nur Admins vergeben Freigaben. Häuser dürfen ihre eigenen Werke weiterhin
--    bearbeiten, aber das Freigabe-Feld nicht selbst setzen.
CREATE OR REPLACE FUNCTION public.plan_beispiel_nur_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.plan_beispiel IS DISTINCT FROM OLD.plan_beispiel
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Plan-Beispiele werden ausschließlich im Admin-Cockpit freigegeben.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS media_assets_plan_beispiel_admin_trg ON public.media_assets;
CREATE TRIGGER media_assets_plan_beispiel_admin_trg
  BEFORE UPDATE OF plan_beispiel ON public.media_assets
  FOR EACH ROW EXECUTE FUNCTION public.plan_beispiel_nur_admin();

DROP TRIGGER IF EXISTS video_assets_plan_beispiel_admin_trg ON public.video_assets;
CREATE TRIGGER video_assets_plan_beispiel_admin_trg
  BEFORE UPDATE OF plan_beispiel ON public.video_assets
  FOR EACH ROW EXECUTE FUNCTION public.plan_beispiel_nur_admin();
