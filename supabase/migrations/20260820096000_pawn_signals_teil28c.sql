-- Teil 28c — Signalstrom: PAWN merkt sich Muster, nie Rohtext. Jede Instanz (pawn-chat,
-- pawn-jarvis) schreibt bei markanten Ereignissen eine kleine, anonyme Musterzeile hierher —
-- nie eine Kundennachricht, nie ein Gesprächsverlauf, nie personenbezogene Daten. "pattern"
-- enthält ausschließlich Kategorien/Zählwerte (z.B. {"welt":"Mode","stimmung":"kante","n":4}),
-- keine Freitextfelder mit Rohinhalt. Internes Werkzeug für Daoudas Cockpit — nicht
-- kundenseitig sichtbar, deshalb rein admin-lesbar.
create table if not exists public.pawn_signals (
  id uuid primary key default gen_random_uuid(),
  quelle text not null,
  kind text not null,
  world text,
  pattern jsonb not null default '{}'::jsonb,
  weight numeric not null default 1,
  created_at timestamptz not null default now()
);

comment on table public.pawn_signals is
  'Teil 28c: musterbasierte Telemetrie (nie Rohtext/Kundendaten) — Grundlage für den nächtlichen Lauf signalstrom_verdichten.';
comment on column public.pawn_signals.pattern is
  'Nur Kategorien/Zählwerte, niemals Rohgespräche, Nachrichteninhalte oder personenbezogene Daten.';

create index if not exists pawn_signals_kind_idx on public.pawn_signals (kind, created_at desc);

alter table public.pawn_signals enable row level security;

create policy "Admin liest Signalstrom"
  on public.pawn_signals for select
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));
