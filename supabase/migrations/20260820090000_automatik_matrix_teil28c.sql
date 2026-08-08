-- Teil 28c — Automatik-Matrix: nur Zone Grün hat einen echten Schalter je Haus.
-- Zone Gelb (PAWN bereitet vor, das Haus bestätigt: veroeffentlichen, preisvorschlag) und
-- Zone Rot (immer ein Mensch: kundennachrichten, geld, loeschen) sind fest im Code hinterlegt
-- (siehe Studio-Seite "Automatik") — für sie gibt es nichts zu speichern, weil sich an ihrem
-- Verhalten nichts einstellen lässt. Nur die vier Grün-Automatiken sind pro Haus togglebar.

create table if not exists public.designer_automations (
  id uuid primary key default gen_random_uuid(),
  designer_id uuid not null references public.designers(id) on delete cascade,
  automation_key text not null check (automation_key in (
    'inszenieren_bei_upload', 'caption_nach_inszenierung', 'aufraeumen_woechentlich', 'sharekit_bei_live'
  )),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (designer_id, automation_key)
);

comment on table public.designer_automations is
  'Teil 28c: je Haus, welche der vier Zone-Grün-Automatiken laufen. Zone Gelb/Rot sind fest im Code, brauchen keine Zeile.';

alter table public.designer_automations enable row level security;

create policy "Haus verwaltet eigene Automatiken"
  on public.designer_automations for all
  using (designer_id in (select id from public.designers where user_id = auth.uid()))
  with check (designer_id in (select id from public.designers where user_id = auth.uid()));

create policy "Admin liest alle Automatiken"
  on public.designer_automations for select
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));
