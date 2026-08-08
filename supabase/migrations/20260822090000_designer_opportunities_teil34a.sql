-- Teil 34a — Offene Türen: Sichtbarkeit im echten Leben. Mini-PAWN findet für sein Haus reale
-- Chancen in der Nähe (Galerien, Ausstellungen, Märkte, offene Ateliers, Schulen/Hochschulen mit
-- Veranstaltungen) und bereitet ein Anschreiben vor. Geringe Menge, hohe Güte: höchstens 3 neue
-- Türen je Haus und Woche (im pawn-jarvis-Modus tueren_finden begrenzt, nicht hier).
create table public.designer_opportunities (
  id uuid primary key default gen_random_uuid(),
  designer_id uuid not null references public.designers(id) on delete cascade,
  title text not null,
  ort text,
  typ text not null default 'sonstiges' check (typ in (
    'galerie', 'ausstellung', 'markt', 'offenes_atelier', 'schule_hochschule', 'sonstiges'
  )),
  quelle_url text,
  warum text,
  status text not null default 'gefunden' check (status in (
    'gefunden', 'interessiert', 'kontaktiert', 'geantwortet', 'verworfen'
  )),
  message_draft text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.designer_opportunities is
  'Teil 34a: reale, ortsnahe Chancen (Galerien, Ausstellungen, Märkte, offene Ateliers, Schulen/Hochschulen), die pawn-jarvis (Modus tueren_finden) je Haus vorschlägt — höchstens 3 pro Haus und Woche.';

alter table public.designer_opportunities enable row level security;

create policy "Haus verwaltet eigene Türen"
  on public.designer_opportunities for all
  using (designer_id in (select id from public.designers where user_id = auth.uid()))
  with check (designer_id in (select id from public.designers where user_id = auth.uid()));

create policy "Admin liest alle Türen"
  on public.designer_opportunities for select
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));

create trigger trg_designer_opportunities_updated before update on public.designer_opportunities
  for each row execute function set_updated_at();

create index designer_opportunities_designer_idx on public.designer_opportunities (designer_id, created_at desc);
