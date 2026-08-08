-- Teil 28c — Das Partie-Buch: jeder Zug, den ein Haus, PAWN oder die Halle macht, in einer
-- durchnummerierten, chronologischen Liste je Haus. Geschrieben wird ausschließlich von
-- Edge Functions (Service-Role, umgeht RLS) — pawn-chat (Onboarding), pawn-jarvis (Automatik),
-- stripe-webhook (Verkäufe als akteur='halle'). Deshalb gibt es hier bewusst keine
-- Insert/Update-Policy für eingeloggte Nutzer: nur Lesen ist über RLS geregelt.

create table if not exists public.partie_zuege (
  id uuid primary key default gen_random_uuid(),
  designer_id uuid not null references public.designers(id) on delete cascade,
  nr integer not null,
  text text not null,
  akteur text not null check (akteur in ('haus', 'pawn', 'halle')),
  quelle text,
  created_at timestamptz not null default now()
);

comment on table public.partie_zuege is
  'Teil 28c: das Partie-Buch — jeder Zug (Haus/PAWN/Halle) je Haus, durchnummeriert. quelle nennt den Ursprung (z.B. automation_key, erste_partie, verkauf).';

create index if not exists partie_zuege_designer_idx on public.partie_zuege (designer_id, nr desc);

alter table public.partie_zuege enable row level security;

create policy "Haus liest eigene Züge"
  on public.partie_zuege for select
  using (designer_id in (select id from public.designers where user_id = auth.uid()));

create policy "Admin liest alle Züge"
  on public.partie_zuege for select
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));
