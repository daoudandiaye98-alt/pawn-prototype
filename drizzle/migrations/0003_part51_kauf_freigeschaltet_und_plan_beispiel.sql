alter table public.designers
  add column if not exists kauf_freigeschaltet boolean not null default false;

create or replace function public.ist_kauf_freigeschaltet(_designer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(public.ist_verkaufsbereit(_designer_id), false)
    or exists (
      select 1 from public.designers d
      join public.user_roles r on r.user_id = d.user_id and r.role = 'admin'
      where d.id = _designer_id
    )
$$;

create or replace function public.trg_designers_kauf_freigeschaltet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.kauf_freigeschaltet := coalesce(public.ist_kauf_freigeschaltet(new.id), false);
  return new;
end;
$$;

drop trigger if exists designers_kauf_freigeschaltet_insert on public.designers;
create trigger designers_kauf_freigeschaltet_insert
before insert on public.designers
for each row execute function public.trg_designers_kauf_freigeschaltet();

drop trigger if exists designers_kauf_freigeschaltet_update on public.designers;
create trigger designers_kauf_freigeschaltet_update
before update on public.designers
for each row execute function public.trg_designers_kauf_freigeschaltet();

update public.designers d
set kauf_freigeschaltet = coalesce(public.ist_kauf_freigeschaltet(d.id), false)
where d.kauf_freigeschaltet is distinct from coalesce(public.ist_kauf_freigeschaltet(d.id), false);

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

ALTER TABLE public.designers
  ADD COLUMN IF NOT EXISTS intern boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.designers.intern IS
  'Test-/Demo-/PAWN-eigenes Haus. Solche Häuser liefern nie Plan-Beispiele.';

UPDATE public.designers d
SET intern = true
WHERE NOT d.intern
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = d.user_id AND ur.role = 'admin'
  );

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