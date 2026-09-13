-- Teil O / 2 — Das Schaufenster als Daten: Bühnen je Haus/Kollektion und der Deko-Katalog.
-- Koordinaten relativ (x, z in 0–1), Höhe in Metern — dieselbe Komposition bei 1280 und 390 px.
-- Werke stehen IMMER auf Ebene 2 (z 0.35–0.65), Deko davor (0–0.30) oder dahinter (0.70–1).

create table if not exists public.heft_deko (
  id                 uuid primary key default gen_random_uuid(),
  key                text not null unique,
  name               text not null,
  art                text not null check (art in ('sockel','bogen','rahmen','vorhang','wand','pflanze','zweig','papier','form','licht')),
  ebene              text not null default 'vorn' check (ebene in ('vorn','hinten')),   -- Deko nie auf der Werk-Ebene
  cutout_url         text,                          -- freigestelltes PNG/WebP, null bis erzeugt
  seitenverhaeltnis  numeric,                       -- breite/höhe
  hoehe_m            numeric not null default 1.0,
  welt               text check (welt in ('mode','interior','kunst') or welt is null),  -- null = alle Welten
  tags               text[] not null default '{}',
  aktiv              boolean not null default false, -- erst aktiv, wenn cutout_url steht
  created_at         timestamptz not null default now()
);

create table if not exists public.heft_buehnen (
  id             uuid primary key default gen_random_uuid(),
  designer_id    uuid references public.designers(id) on delete cascade,
  collection_id  uuid references public.curated_collections(id) on delete cascade,
  welt           text check (welt in ('mode','interior','kunst') or welt is null),
  blatt          integer not null default 0,                      -- Position im liegenden Heft je Welt
  layout         text not null default 'fan' check (layout in ('fan','reihe','frame','frei')),
  kicker         text,
  titel          text,                                            -- darf <em> tragen
  text           text,
  boden          jsonb not null default '{"papier":"weiss"}'::jsonb,
  ruecken        jsonb not null default '{}'::jsonb,              -- {art:'bogen'|'wand'|'keiner', farbe}
  licht          jsonb not null default '{}'::jsonb,
  stuecke        jsonb not null default '[]'::jsonb,              -- [{product_id, x, z, hoehe_m, spiegeln}] — mind. 3, sonst nicht veröffentlichbar
  deko           jsonb not null default '[]'::jsonb,              -- [{deko_key, x, z, hoehe_m, spiegeln}]
  eigenhaendig   boolean not null default false,                 -- true, sobald das Haus etwas verschoben hat → Automatik fasst es nicht mehr an
  veroeffentlicht boolean not null default false,
  version        integer not null default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint heft_buehnen_besitzer check (designer_id is not null or collection_id is not null)
);
create index if not exists heft_buehnen_designer on public.heft_buehnen (designer_id) where designer_id is not null;
create index if not exists heft_buehnen_welt_blatt on public.heft_buehnen (welt, blatt) where veroeffentlicht;

alter table public.heft_deko    enable row level security;
alter table public.heft_buehnen enable row level security;

drop policy if exists "heft_deko lesen" on public.heft_deko;
create policy "heft_deko lesen" on public.heft_deko for select to anon, authenticated using (aktiv);
drop policy if exists "heft_deko admin" on public.heft_deko;
create policy "heft_deko admin" on public.heft_deko for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Veröffentlichte Bühnen sieht jeder; Entwürfe nur das Haus (und der Admin).
drop policy if exists "heft_buehnen oeffentlich" on public.heft_buehnen;
create policy "heft_buehnen oeffentlich" on public.heft_buehnen for select to anon, authenticated using (veroeffentlicht);
drop policy if exists "heft_buehnen haus" on public.heft_buehnen;
create policy "heft_buehnen haus" on public.heft_buehnen for all to authenticated
  using (public.has_role(auth.uid(),'admin') or exists (select 1 from public.designers d where d.id = heft_buehnen.designer_id and d.user_id = auth.uid()))
  with check (public.has_role(auth.uid(),'admin') or exists (select 1 from public.designers d where d.id = heft_buehnen.designer_id and d.user_id = auth.uid()));

grant select on public.heft_deko, public.heft_buehnen to anon, authenticated;
grant insert, update, delete on public.heft_buehnen to authenticated;
grant all on public.heft_deko, public.heft_buehnen to service_role;

-- Regel 1 (mindestens drei Werke) und Regel Ebene 2 werden beim Veröffentlichen erzwungen, nicht nur im Frontend.
create or replace function public.heft_buehne_pruefen()
returns trigger language plpgsql as $tg$
declare s jsonb; n int;
begin
  if new.veroeffentlicht then
    n := jsonb_array_length(coalesce(new.stuecke, '[]'::jsonb));
    if n < 3 then raise exception 'buehne_braucht_drei_werke' using hint = format('%s Werke, mindestens 3', n); end if;
    for s in select * from jsonb_array_elements(new.stuecke) loop
      if (s->>'z')::numeric < 0.35 or (s->>'z')::numeric > 0.65 then
        raise exception 'werk_nicht_auf_ebene_zwei' using hint = 'Werke stehen bei z 0.35–0.65';
      end if;
    end loop;
  end if;
  new.updated_at := now();
  return new;
end; $tg$;
drop trigger if exists heft_buehnen_pruefen on public.heft_buehnen;
create trigger heft_buehnen_pruefen before insert or update on public.heft_buehnen for each row execute function public.heft_buehne_pruefen();

-- Deko-Katalog: Namen und Arten stehen fest, die Bilder werden mit Higgsfield erzeugt (cutout_url), dann aktiv=true.
insert into public.heft_deko (key, name, art, ebene, hoehe_m, welt, tags) values
  ('sockel_weiss',    'Sockel, weiß',          'sockel',  'vorn',   0.45, null,       '{sockel,weiss,neutral}'),
  ('sockel_holz',     'Sockel, Eiche',         'sockel',  'vorn',   0.45, 'interior', '{sockel,holz,warm}'),
  ('sockel_stein',    'Sockel, Stein',         'sockel',  'vorn',   0.60, 'kunst',    '{sockel,stein,roh}'),
  ('bogen_papier',    'Bogen, Papier',         'bogen',   'hinten', 3.20, null,       '{bogen,papier,still}'),
  ('bogen_schwarz',   'Bogen, Schwarz',        'bogen',   'hinten', 3.20, 'mode',     '{bogen,schwarz,klar}'),
  ('rahmen_gold',     'Rahmen, Gold',          'rahmen',  'hinten', 2.40, 'kunst',    '{rahmen,gold,warm}'),
  ('rahmen_schwarz',  'Rahmen, Schwarz',       'rahmen',  'hinten', 2.40, null,       '{rahmen,schwarz,klar}'),
  ('vorhang_leinen',  'Vorhang, Leinen',       'vorhang', 'hinten', 3.00, null,       '{vorhang,leinen,weich}'),
  ('vorhang_samt',    'Vorhang, Samt',         'vorhang', 'hinten', 3.00, 'interior', '{vorhang,samt,warm}'),
  ('wand_beton',      'Wand, Beton',           'wand',    'hinten', 3.00, null,       '{wand,beton,roh}'),
  ('wand_terrakotta', 'Wand, Terrakotta',      'wand',    'hinten', 3.00, 'interior', '{wand,terrakotta,warm}'),
  ('pflanze_olive',   'Olivenbaum',            'pflanze', 'vorn',   1.60, null,       '{pflanze,olive,still}'),
  ('pflanze_monstera','Monstera',              'pflanze', 'vorn',   1.40, 'interior', '{pflanze,gruen}'),
  ('zweig_magnolie',  'Zweig, Magnolie',       'zweig',   'vorn',   1.20, 'mode',     '{zweig,weich}'),
  ('zweig_trocken',   'Zweig, getrocknet',     'zweig',   'vorn',   1.30, null,       '{zweig,roh,sand}'),
  ('papier_bogen',    'Papierbogen, gerollt',  'papier',  'vorn',   0.80, 'kunst',    '{papier,geste}'),
  ('papier_stapel',   'Papierstapel',          'papier',  'vorn',   0.30, null,       '{papier,still}'),
  ('form_kugel',      'Kugel, matt',           'form',    'vorn',   0.50, null,       '{form,rund,minimal}'),
  ('form_saeule',     'Säule, Fragment',       'form',    'hinten', 2.20, 'kunst',    '{form,saeule,plastisch}'),
  ('licht_stehlampe', 'Stehlampe',             'licht',   'vorn',   1.70, 'interior', '{licht,warm}'),
  ('licht_spot',      'Spot, weich',           'licht',   'hinten', 0.10, null,       '{licht,spot}')
on conflict (key) do nothing;

