-- Eine Anmeldung darf nie daran scheitern, dass die Zugangs-Starthilfe stolpert.
-- Der Trigger fängt jeden Fehler ab, schreibt ihn in ein Protokoll und lässt die
-- Registrierung durch. Ohne das meldet die Seite nur "{}" und niemand weiss, warum.
--
-- HERKUNFT DIESER DATEI: am 11.09.2026 direkt auf cnxtdcifkrdxvajaikxq angewandt,
-- ohne Datei im Repo. Wörtlich zurückgeholt aus supabase_migrations.schema_migrations
-- (Version 20260929110000), damit der nächste Rückweg sie nicht ersatzlos löscht.

create table if not exists public.zugang_protokoll (
  id        bigint generated always as identity primary key,
  wann      timestamptz not null default now(),
  email     text,
  fehler    text,
  detail    text
);
alter table public.zugang_protokoll enable row level security;

create or replace function public.zugang_bei_anmeldung()
returns trigger
language plpgsql
security definer
set search_path = public
as $tg$
begin
  begin
    perform public.zugang_zuweisen(new.id, new.email);
  exception when others then
    insert into public.zugang_protokoll (email, fehler, detail)
    values (new.email, sqlerrm, sqlstate);
  end;
  return new;
end;
$tg$;
