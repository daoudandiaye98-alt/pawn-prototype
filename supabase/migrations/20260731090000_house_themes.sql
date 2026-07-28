-- Teil 15a: Das Haus-Thema — Vibecoding statt Baukasten.
-- Der Designer beschreibt seine Welt in eigenen Worten; PAWN übersetzt das zusammen mit
-- Brand-DNA und Kulturströmungen in ein vollständiges Thema (Farbwelt, Typografie-Paarung,
-- Flächenrhythmus, Kantenhärte, Bewegungscharakter, Hintergrundtextur, Übergangsart).
-- Versioniert: jede Fassung bleibt erhalten (speicherbar, vergleichbar, zurücknehmbar) —
-- immer genau eine Version je Haus ist "is_current". Gilt ausschließlich innerhalb der
-- Hausseite und ihrer Produktseiten; Halle, Kasse und Konto lesen diese Tabelle nie.
create table public.house_themes (
  id uuid primary key default gen_random_uuid(),
  designer_id uuid not null references public.designers(id) on delete cascade,
  version int not null default 1,
  is_current boolean not null default true,
  name text,
  input_prompt text,
  farbwelt jsonb not null default '{"bg":"#FFFFFF","fg":"#000000","accent":"#000000","muted":"#F2F2F2"}'::jsonb,
  typografie text not null default 'editorial',
  flaechenrhythmus text not null default 'ruhig',
  kantenhaerte text not null default 'hart',
  bewegungscharakter text not null default 'ruhig',
  hintergrundtextur jsonb not null default '{"typ":"keine"}'::jsonb,
  uebergangsart text not null default 'fade',
  zuversicht text not null default 'mittel',
  quelle text not null default 'manuell_verfeinert',
  guardrail_notes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Genau eine aktuelle Version je Haus.
create unique index house_themes_one_current_per_designer on public.house_themes (designer_id) where is_current;
create index house_themes_designer_version_idx on public.house_themes (designer_id, version desc);

alter table public.house_themes enable row level security;

create policy "designer manages own house_themes" on public.house_themes
  for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role) or exists (
    select 1 from public.designers d where d.id = house_themes.designer_id and d.user_id = auth.uid()
  ))
  with check (has_role(auth.uid(), 'admin'::app_role) or exists (
    select 1 from public.designers d where d.id = house_themes.designer_id and d.user_id = auth.uid()
  ));

-- Öffentlich lesbar: nur die aktuelle Version, nur wenn die Hausseite veröffentlicht ist.
create policy "public reads current theme of published pages" on public.house_themes
  for select
  using (is_current and exists (
    select 1 from public.designers d where d.id = house_themes.designer_id and d.page_published_at is not null
  ));

create trigger trg_house_themes_updated before update on public.house_themes
  for each row execute function set_updated_at();
