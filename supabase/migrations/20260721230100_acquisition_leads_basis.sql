-- Die Grundform von acquisition_leads.
--
-- WARUM ES DIESE DATEI GIBT: Die Tabelle hat auf dem alten Projekt existiert, aber nie
-- eine Datei gehabt. 24 Migrationen aendern sie, keine legt sie an. Der Erstaufbau auf
-- cnxtdcifkrdxvajaikxq brach deshalb bei 20260721230200_jarvis_akquise_autopilot.sql ab:
--   ERROR: 42P01: relation "public.acquisition_leads" does not exist
-- Die alte Datenbank ist geloescht; es gibt keinen woertlichen Text zum Zurueckholen.
--
-- WIE DIE FORM ENTSTANDEN IST — abgeleitet, nicht geraten:
--   Endzustand aus src/integrations/supabase/types.ts (59 Spalten, erzeugt vom alten
--   Projekt) MINUS die 44 Spalten, die die 24 spaeteren Dateien selbst per ADD COLUMN
--   anlegen. Rest: die 15 Spalten unten. Gegenprobe: keine spaeter hinzugefuegte Spalte
--   fehlt im Endzustand, und keine der 15 wird spaeter noch einmal angelegt.
--   Nachpruefbar: nach allen 24 Dateien muss die Tabelle wieder exakt 59 Spalten haben.
--
-- WAS HIER BEWUSST NICHT STEHT, weil es spaeter kommt und dort belegt ist:
--   · der Status-Constraint  → 20260920090000_akquise_befund3_status_constraint.sql
--   · der eindeutige handle  → 20260910090000_akquise_wp5_jagd_haerten.sql
--   · jeder Index            → die jeweilige spaetere Datei
--
-- Der Dateiname sortiert vor 20260721230200, der ersten Datei, die die Tabelle aendert.

create table if not exists public.acquisition_leads (
  -- uuid ist belegt: drei Tabellen zeigen mit `uuid REFERENCES public.acquisition_leads(id)`
  -- hierher (20260809132840, 20260811090000, 20260824090000).
  id            uuid primary key default gen_random_uuid(),

  -- In types.ts ohne `| null`, also NOT NULL. Der eindeutige Index darauf kommt spaeter.
  handle        text not null,

  -- In types.ts ohne `| null`. Der Vorgabewert 'neu' ist der erste Wert der Constraint-
  -- Liste aus 20260920090000 und der einzige, der einen frisch gefundenen Lead beschreibt.
  status        text not null default 'neu',

  world         text,
  source        text,
  bio           text,
  notes         text,
  personal_line text,

  followers     integer,
  clips         jsonb,

  contacted_at  timestamptz,
  followup_at   timestamptz,
  warmed_at     timestamptz,

  -- In types.ts als `string | null` — also NICHT NOT NULL, trotz Vorgabewert.
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- RLS VON ANFANG AN. Keine offene Tabelle, die spaeter zugemacht wird.
--
-- BEFUND, der in den Bericht gehoert: KEINE der 161 Dateien legt je eine Policy auf
-- acquisition_leads. Was die alte Datenbank trug, ist nicht mehr feststellbar. Die Wahl
-- hier ist deshalb abgeleitet, nicht uebernommen, und sie faellt in die sichere Richtung:
--
--   · Die Tabelle traegt personenbezogene Daten fremder Menschen (handle, bio, spaeter
--     email, business_phone, contact_name). Sie darf anon nie sehen.
--   · src/pages/admin/AdminAkquise.tsx liest und schreibt sie ueber den normalen Client
--     mit dem JWT des angemeldeten Menschen. Ohne Policy waere das Cockpit blind.
--   · Die Form ist das Muster jeder anderen Admin-Tabelle dieses Repos
--     (ai_actions_log, jarvis_runs, posting_queue): has_role(auth.uid(), 'admin').
alter table public.acquisition_leads enable row level security;

grant select, insert, update, delete on public.acquisition_leads to authenticated;
grant all on public.acquisition_leads to service_role;

drop policy if exists "admin verwaltet akquise" on public.acquisition_leads;
create policy "admin verwaltet akquise" on public.acquisition_leads
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
