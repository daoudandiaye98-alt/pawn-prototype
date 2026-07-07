create type public.ai_integration_kind as enum ('gmail','instagram','webhook','custom');

create table public.ai_integrations (
  id uuid primary key default gen_random_uuid(),
  kind public.ai_integration_kind not null,
  label text not null,
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  event_types text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.ai_integrations to authenticated;
grant all on public.ai_integrations to service_role;

alter table public.ai_integrations enable row level security;

create policy "admin read integrations"
  on public.ai_integrations for select
  to authenticated
  using (public.has_role(auth.uid(),'admin'));

create policy "admin write integrations"
  on public.ai_integrations for all
  to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

insert into public.ai_config (key, value)
values ('copilot_prompt', jsonb_build_object(
  'system_prompt',
  'Du bist PAWN Copilot — ein leiser, präziser Partner für unabhängige Designer. Antworte auf Deutsch, sachlich, ohne Marketing-Floskeln. Baue jede Antwort auf den konkreten Store-Daten des Designers auf. Ein Vorschlag pro Antwort, wenn möglich.'
))
on conflict (key) do nothing;