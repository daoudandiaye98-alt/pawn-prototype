-- PART 51 Teil C — Übergangslösung Kauf: Solange ein Haus kein eigenes Stripe-Connect-Konto hat
-- (und keinem Admin gehört), bleibt der Checkout für seine Werke deaktiviert — die Produktseite
-- zeigt stattdessen "Anfragen" als Kaufweg. `verkaufsbereit` (Teil AP-Kasse) prüft schon
-- Stripe/Rechnungsdaten/Versand, kennt aber keine Admin-Ausnahme (die läuft bisher nur
-- server-seitig in create-checkout). Diese Spalte ist dieselbe Wahrheit, öffentlich lesbar,
-- inklusive Admin-Ausnahme — ein Toggle je Haus, das automatisch umschaltet, sobald Connect
-- Express abgeschlossen ist.

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

-- BEFORE INSERT zusätzlich zu UPDATE, damit frisch angelegte Häuser (First Move, approve_designer)
-- den korrekten Anfangswert bekommen, statt bis zur ersten Änderung auf false zu stehen.
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
