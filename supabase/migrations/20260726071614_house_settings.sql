-- Teil 14c: eigene, benannte Settings je Haus — das Gegenstück zum Haus-Model.
-- Ein Designer legt einen wiederverwendbaren Rahmen an (Ort, Licht, Stimmung, Palette,
-- Referenzbilder aus der Mediathek) und nutzt ihn über Kampagnen hinweg. PAWN kann aus
-- Brand-DNA + Kulturströmung einen Vorschlag machen (quelle='vorschlag'), der Designer
-- entscheidet immer selbst, ob er ihn übernimmt und benennt.
create table public.house_settings (
  id uuid primary key default gen_random_uuid(),
  designer_id uuid not null references public.designers(id) on delete cascade,
  name text not null,
  ort text,
  licht text,
  stimmung text,
  palette text,
  referenzbilder text[] not null default '{}',
  quelle text not null default 'manuell',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.house_settings enable row level security;

-- Gleiches Muster wie house_models: Designer verwaltet sein eigenes, Admin sieht/verwaltet alles.
create policy "designer manages own house_settings" on public.house_settings
  for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role) or exists (
    select 1 from public.designers d where d.id = house_settings.designer_id and d.user_id = auth.uid()
  ))
  with check (has_role(auth.uid(), 'admin'::app_role) or exists (
    select 1 from public.designers d where d.id = house_settings.designer_id and d.user_id = auth.uid()
  ));

create trigger trg_house_settings_updated before update on public.house_settings
  for each row execute function set_updated_at();
