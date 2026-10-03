-- Teil O / 3 — Stil-Archetypen: der Katalog, die Zuordnung je Kunde, die Berechnung.
-- Vokabular = exakt die Wörter des Bilderquiz (beratung.mjs VOKABULAR), großgeschrieben,
-- damit dieselbe Passung greift, die das Heft heute schon rechnet.
-- Zwei Achsen: WAS jemand mag (Archetyp, aus Quiz/Merkliste/Foto/Kauf) und WIE jemand sich
-- bewegt (Zuglogik, aus den Ereignissen) — beide ehrlich aus Daten, nie aus Vermutung.

create table if not exists public.stil_archetypen (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,
  welt          text not null check (welt in ('mode','interior','kunst')),
  name          text not null,                 -- „Die Linie"
  name_en       text,
  figur         text not null check (figur in ('bauer','springer','laeufer','turm','dame','koenig')),  -- Charakter der Karte
  kurz          text not null,                 -- ein Satz, Bühnen-Register
  kurz_en       text,
  beschreibung  text,                          -- drei bis fünf Sätze
  richtung      text[] not null default '{}',  -- Quiz-Werte der Richtung, die tragen (z. B. {Klar})
  form          text[] not null default '{}',  -- Quiz-Werte der Form/Material/Format (z. B. {Gerade,Tailliert})
  woerter       text[] not null default '{}',  -- weitere Wörter, kleingeschrieben, für die Passung gegen product.dna
  farbregister  text not null default 'beide' check (farbregister in ('warm','kuehl','neutral','beide')),
  nahe          text[] not null default '{}',  -- keys benachbarter Archetypen
  haus_archetypen text[] not null default '{}',-- Brücke zu designers.brand_dna.archetyp
  bild_url      text,                          -- Referenzbild (Higgsfield), site-assets
  sort          integer not null default 0,
  aktiv         boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.kunden_archetyp (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  archetyp_key  text references public.stil_archetypen(key) on delete set null,
  zuversicht    numeric not null default 0 check (zuversicht >= 0 and zuversicht <= 1),
  belege        jsonb not null default '[]'::jsonb,     -- [{art:'quiz'|'foto'|'merkliste'|'anprobe'|'kauf', text, gewicht}]
  alternativen  jsonb not null default '[]'::jsonb,     -- [{key, score}]
  zuglogik      text check (zuglogik in ('turm','laeufer','springer','dame','koenig') or zuglogik is null),
  bestaetigt    boolean not null default false,          -- „Das bin ich" — dann überschreibt die Rechnung den Schlüssel nicht mehr
  abgelehnt     text[] not null default '{}',             -- Archetypen, die die Person ausdrücklich verneint hat
  berechnet_am  timestamptz,
  updated_at    timestamptz not null default now()
);

alter table public.stil_archetypen enable row level security;
alter table public.kunden_archetyp enable row level security;
drop policy if exists "stil_archetypen lesen" on public.stil_archetypen;
create policy "stil_archetypen lesen" on public.stil_archetypen for select to anon, authenticated using (aktiv);
drop policy if exists "stil_archetypen admin" on public.stil_archetypen;
create policy "stil_archetypen admin" on public.stil_archetypen for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
drop policy if exists "kunden_archetyp eigen" on public.kunden_archetyp;
create policy "kunden_archetyp eigen" on public.kunden_archetyp for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select on public.stil_archetypen to anon, authenticated;
grant select, insert, update on public.kunden_archetyp to authenticated;
grant all on public.stil_archetypen, public.kunden_archetyp to service_role;

-- Der Katalog: 6 je Welt. richtung/form tragen die Quiz-Wörter; woerter erweitern die Passung.
insert into public.stil_archetypen (key, welt, name, name_en, figur, kurz, richtung, form, woerter, farbregister, nahe, sort) values
  ('mode_linie',    'mode', 'Die Linie',     'The Line',     'turm',     'Schwarz, Elfenbein, ein Schnitt. Nichts, was nicht sein muss.',            '{Klar}',        '{Gerade,Tailliert}', '{klar,schwarz,elfenbein,minimal,reduziert,schnitt,kante,gerade,schmal}', 'kuehl',  '{mode_rahmen,mode_werkzeug}', 10),
  ('mode_huelle',   'mode', 'Die Hülle',     'The Drape',    'laeufer',  'Stoff, der fällt. Volumen, das trägt.',                                     '{Weich}',       '{Weit}',             '{weich,fließend,seide,creme,sand,drapiert,weit,oversize,volumen}',      'warm',   '{mode_schicht,mode_signal}',   20),
  ('mode_rahmen',   'mode', 'Der Rahmen',    'The Frame',    'koenig',   'Wenige Stücke, jedes sitzt. Figur, gefasst.',                              '{Klar,Weich}',  '{Tailliert}',        '{tailliert,taille,figurbetont,gegürtet,klar,schnitt}',                   'beide',  '{mode_linie,mode_huelle}',     30),
  ('mode_schicht',  'mode', 'Die Schicht',   'The Layer',    'springer', 'Übereinander, nebeneinander. Creme auf Sand auf Leinen.',                   '{Weich,Roh}',   '{Lagen}',            '{lagen,layering,schichten,übereinander,leinen,creme,sand}',              'warm',   '{mode_huelle,mode_werkzeug}',  40),
  ('mode_werkzeug', 'mode', 'Das Werkzeug',  'The Tool',     'turm',     'Denim, Leder, Canvas. Gemacht, um benutzt zu werden.',                     '{Roh}',         '{Gerade,Weit}',      '{roh,denim,leder,canvas,workwear,robust}',                               'neutral','{mode_linie,mode_schicht}',    50),
  ('mode_signal',   'mode', 'Das Signal',    'The Signal',   'dame',     'Farbe zuerst. Print, Muster, ein Rot, das den Raum betritt.',              '{Laut}',        '{Weit,Tailliert}',   '{laut,farbe,bunt,rot,blau,print,muster}',                                'beide',  '{mode_huelle,mode_rahmen}',    60),
  ('interior_licht',   'interior', 'Das Licht',     'The Light',      'turm',     'Hell, leise, Leinen. Ein Raum, der atmet.',                          '{Still}',            '{Textil,Holz}', '{still,hell,leinen,licht,ruhig,luft,minimal,esche,ahorn}',            'kuehl',  '{interior_werkstatt,interior_rohbau}', 10),
  ('interior_waerme',  'interior', 'Die Wärme',     'The Warmth',     'laeufer',  'Terrakotta, Samt, Keramik. Oberflächen, die man anfasst.',           '{Warm}',             '{Ton,Textil}',  '{warm,terrakotta,samt,keramik,ton,ocker,bouclé,creme,steinzeug}',     'warm',   '{interior_salon,interior_werkstatt}',  20),
  ('interior_rohbau',  'interior', 'Der Rohbau',    'The Shell',      'turm',     'Beton, Stahl, Eiche. Ehrlich bis in die Kante.',                     '{Roh}',              '{Stahl,Holz}',  '{roh,beton,stahl,eiche,ehrlich,metall,eisen}',                        'neutral','{interior_licht,interior_objekt}',     30),
  ('interior_objekt',  'interior', 'Das Objekt',    'The Object',     'springer', 'Ein Stück, das den Raum bestimmt. Form vor Funktion.',              '{Skulptural}',       '{Ton,Stahl}',   '{skulptural,farbe,form,objekt,spiel,messing,porzellan}',              'beide',  '{interior_rohbau,interior_salon}',     40),
  ('interior_werkstatt','interior','Die Werkstatt', 'The Workshop',   'koenig',   'Nussbaum, Eiche, Kiefer. Dinge, die bleiben.',                       '{Warm,Still}',       '{Holz}',        '{holz,eiche,nussbaum,kiefer,ahorn,esche,warm}',                       'warm',   '{interior_licht,interior_waerme}',     50),
  ('interior_salon',   'interior', 'Der Salon',     'The Salon',      'dame',     'Samt, Farbe, Volumen. Ein Raum, der empfängt.',                      '{Skulptural,Warm}',  '{Textil}',      '{samt,farbe,bouclé,textil,stoff,wolle,spiel}',                        'warm',   '{interior_waerme,interior_objekt}',    60),
  ('kunst_portraet',  'kunst', 'Das Porträt',   'The Portrait',  'koenig',   'Ein Mensch, nah. Blatt für Blatt.',                                   '{Figurativ}',        '{Klein,Serie}',       '{figurativ,figur,porträt,portrait,körper,mensch,klein,blatt,nah}',     'beide',  '{kunst_geste,kunst_wand}',    10),
  ('kunst_farbfeld',  'kunst', 'Das Farbfeld',  'The Field',     'turm',     'Fläche, Ordnung, Leinwand. Farbe als Raum.',                          '{Abstrakt}',         '{Wandfüllend}',       '{abstrakt,fläche,farbfeld,ordnung,geometrisch,leinwand,groß}',          'kuehl',  '{kunst_folge,kunst_wand}',    20),
  ('kunst_geste',     'kunst', 'Die Geste',     'The Gesture',   'laeufer',  'Tusche, Papier, Energie. Der Strich, bevor er nachdenkt.',            '{Geste}',            '{Klein,Serie}',       '{geste,tusche,papier,zeichnung,energie,bewegung,pigment}',              'neutral','{kunst_portraet,kunst_folge}', 30),
  ('kunst_plastik',   'kunst', 'Die Plastik',   'The Sculpture', 'springer', 'Bronze, Keramik, Raum. Etwas, um das man herumgeht.',                 '{Plastisch}',        '{Objekt}',            '{plastisch,skulptur,bronze,objekt,keramik,plastik,raum}',               'warm',   '{kunst_farbfeld,kunst_wand}', 40),
  ('kunst_folge',     'kunst', 'Die Folge',     'The Sequence',  'turm',     'Edition, Serie, mehrteilig. Ein Gedanke in Teilen.',                  '{Abstrakt,Geste}',   '{Serie}',             '{serie,edition,mehrteilig,teile,pigment,papier}',                       'neutral','{kunst_farbfeld,kunst_geste}', 50),
  ('kunst_wand',      'kunst', 'Die Wand',      'The Wall',      'dame',     'Groß, raumfüllend. Ein Bild, das die Wand ist.',                      '{Figurativ,Abstrakt}','{Wandfüllend}',      '{wandfüllend,groß,leinwand,raum,öl}',                                   'beide',  '{kunst_farbfeld,kunst_portraet}', 60)
on conflict (key) do nothing;

-- Die Berechnung. Eingaben: Konto (kunden_stil, kunden_bilder/anproben falls vorhanden, orders) + Merkliste vom Gerät.
-- Gewichte wie ai_config.matching_weights: Richtung (mood) 2, Form (silhouette) 1.8. Merkliste +0.5 je Werk mit Treffer (max 2),
-- Anprobe „passt" +0.7 (max 1.4), Kauf +1 (max 2). Zuversicht nach Belegstufe, nie aus dem Score allein.
create or replace function public.archetyp_berechnen(_merkliste_slugs text[] default '{}')
returns table (archetyp_key text, zuversicht numeric, belege jsonb, alternativen jsonb, bestaetigt boolean)
language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  k public.kunden_stil%rowtype;
  hat_foto boolean := false; n_merk int := 0; n_kauf int := 0; n_anprobe int := 0;
  bestes record; alt jsonb; z numeric; bel jsonb := '[]'::jsonb;
begin
  if uid is null then return; end if;
  select * into k from public.kunden_stil where user_id = uid;
  if not found or k.welt is null then return; end if;
  hat_foto := k.foto_befund is not null;

  -- Score je Archetyp der Welt
  create temp table if not exists _sc (key text primary key, score numeric) on commit drop;
  delete from _sc;
  insert into _sc
  select a.key,
         (case when k.richtung = any(a.richtung) then 2.0 else 0 end)
       + (case when k.form     = any(a.form)     then 1.8 else 0 end)
       + least(2.0, 0.5 * (select count(*) from public.products p
                            where p.slug = any(_merkliste_slugs)
                              and exists (select 1 from unnest(a.woerter) w where lower(coalesce(p.product_dna::text,'') || ' ' || coalesce(p.tags::text,'')) like '%' || w || '%')))
       + least(2.0, 1.0 * (select count(distinct o.id) from public.orders o join public.products p
                              on (o.items::text like '%' || p.id::text || '%' or o.items::text like '%' || p.slug || '%')
                            where o.user_id = uid and o.paid_at is not null
                              and exists (select 1 from unnest(a.woerter) w where lower(coalesce(p.product_dna::text,'')) like '%' || w || '%')))
  from public.stil_archetypen a where a.welt = k.welt and a.aktiv;

  -- Anproben, falls die Tabelle existiert
  if to_regclass('public.anproben') is not null then
    update _sc s set score = s.score + least(1.4, 0.7 * (
      select count(*) from public.anproben an join public.products p on p.id = an.product_id join public.stil_archetypen a on a.key = s.key
       where an.user_id = uid and an.bewertung = 'passt'
         and exists (select 1 from unnest(a.woerter) w where lower(coalesce(p.product_dna::text,'')) like '%' || w || '%')));
    select count(*) into n_anprobe from public.anproben where user_id = uid and bewertung = 'passt';
  end if;

  select count(*) into n_merk from public.products where slug = any(_merkliste_slugs);
  select count(*) into n_kauf from public.orders where user_id = uid and paid_at is not null;

  select key, score into bestes from _sc order by score desc, key limit 1;
  select jsonb_agg(jsonb_build_object('key', key, 'score', round(score,2)) order by score desc) into alt from (select * from _sc order by score desc limit 3) t;

  -- Zuversicht nach Belegstufe
  z := 0.4;
  if hat_foto then z := 0.55; end if;
  if n_merk >= 3 then z := greatest(z, 0.7); end if;
  if n_anprobe >= 1 then z := greatest(z, 0.75); end if;
  if n_kauf >= 1 then z := greatest(z, 0.85); end if;

  bel := bel || jsonb_build_object('art','quiz','text', format('%s · %s · %s', k.welt, coalesce(k.richtung,'—'), coalesce(k.form,'—')), 'gewicht', 3.8);
  if hat_foto then bel := bel || jsonb_build_object('art','foto','text','Farbregister aus deinem Foto','gewicht',1); end if;
  if n_merk > 0 then bel := bel || jsonb_build_object('art','merkliste','text', format('%s gemerkte Stücke', n_merk), 'gewicht', least(2, 0.5*n_merk)); end if;
  if n_anprobe > 0 then bel := bel || jsonb_build_object('art','anprobe','text', format('%s Anproben, die passten', n_anprobe), 'gewicht', least(1.4, 0.7*n_anprobe)); end if;
  if n_kauf > 0 then bel := bel || jsonb_build_object('art','kauf','text', format('%s Käufe', n_kauf), 'gewicht', least(2, n_kauf)); end if;

  insert into public.kunden_archetyp (user_id, archetyp_key, zuversicht, belege, alternativen, berechnet_am)
  values (uid, bestes.key, z, bel, coalesce(alt,'[]'::jsonb), now())
  on conflict (user_id) do update set
    archetyp_key = case when kunden_archetyp.bestaetigt then kunden_archetyp.archetyp_key else excluded.archetyp_key end,
    zuversicht   = case when kunden_archetyp.bestaetigt then 1.0 else excluded.zuversicht end,
    belege = excluded.belege, alternativen = excluded.alternativen, berechnet_am = now(), updated_at = now();

  return query select a.archetyp_key, a.zuversicht, a.belege, a.alternativen, a.bestaetigt from public.kunden_archetyp a where a.user_id = uid;
end; $fn$;
revoke all on function public.archetyp_berechnen(text[]) from public, anon;
grant execute on function public.archetyp_berechnen(text[]) to authenticated;

-- „Das bin ich" / „Eher nicht"
create or replace function public.archetyp_bestaetigen(_key text, _ja boolean)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if auth.uid() is null then return; end if;
  insert into public.kunden_archetyp (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  if _ja then
    update public.kunden_archetyp set archetyp_key = _key, bestaetigt = true, zuversicht = 1.0, updated_at = now() where user_id = auth.uid();
  else
    update public.kunden_archetyp set abgelehnt = case when _key = any(abgelehnt) then abgelehnt else array_append(abgelehnt, _key) end,
      bestaetigt = false, updated_at = now() where user_id = auth.uid();
  end if;
end; $fn$;
revoke all on function public.archetyp_bestaetigen(text, boolean) from public, anon;
grant execute on function public.archetyp_bestaetigen(text, boolean) to authenticated;

