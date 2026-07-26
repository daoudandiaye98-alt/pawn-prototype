-- Teil 14b: Kulturgedächtnis. Eine Ebene über der bestehenden fashion_ontology (reines
-- Vokabular) — cultural_currents hält Zusammenhänge fest: welche Strömung entsteht,
-- woraus speist sie sich, wie sieht sie aus, welche Häuser stehen ihr nahe. Rein additiv,
-- keine bestehende Tabelle/Policy wird verändert.
create table public.cultural_currents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  zeitraum text,
  ausloeser text,
  praegende_kuenstler jsonb not null default '[]'::jsonb,
  visuelle_merkmale jsonb not null default '{}'::jsonb,
  ontologie_begriffe text[] not null default '{}',
  nahe_haeuser uuid[] not null default '{}',
  quellen jsonb not null default '[]'::jsonb,
  zuversicht text not null default 'mittel',
  worlds text[] not null default '{}',
  quelle_typ text not null default 'recherchiert',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cultural_currents enable row level security;

-- Gleiches Muster wie fashion_ontology: Admin verwaltet, alle können lesen (Kuratierung
-- und die Genom-Karte lesen diese Ebene später mit, Teil 14c/15c).
create policy "cultural_currents_admin_write" on public.cultural_currents
  for all to authenticated using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));

create policy "cultural_currents_public_read" on public.cultural_currents
  for select to public using (true);

create trigger trg_cultural_currents_updated before update on public.cultural_currents
  for each row execute function set_updated_at();
