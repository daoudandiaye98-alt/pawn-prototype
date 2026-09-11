-- Berichtigung: `page_published_at` gibt es in designers noch nicht (kommt erst
-- spaeter in der Migrationskette). Der Einfuegeversuch hat die Registrierung mit
-- HTTP 500 abgebrochen — die Seite zeigte nur "{}".
-- Diese Fassung benutzt nur Spalten, die es gibt, und setzt page_published_at
-- nachtraeglich, sobald die Spalte existiert.
--
-- HERKUNFT DIESER DATEI: am 11.09.2026 direkt auf cnxtdcifkrdxvajaikxq angewandt,
-- ohne Datei im Repo. Wörtlich zurückgeholt aus supabase_migrations.schema_migrations
-- (Version 20260929120000), damit der nächste Rückweg sie nicht ersatzlos löscht.

create or replace function public.zugang_zuweisen(_user_id uuid, _email text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  b public.zugang_bootstrap%rowtype;
  haus_id uuid;
begin
  select * into b from public.zugang_bootstrap where email = lower(_email);
  if not found then return; end if;

  insert into public.user_roles (user_id, role)
  values (_user_id, b.rolle)
  on conflict (user_id, role) do nothing;

  insert into public.profiles (id, display_name)
  values (_user_id, split_part(b.email, '@', 1))
  on conflict (id) do nothing;

  if b.rolle <> 'designer' or b.haus_slug is null then return; end if;
  if to_regclass('public.designers') is null then return; end if;

  select id into haus_id from public.designers where slug = b.haus_slug;

  if haus_id is null then
    insert into public.designers (user_id, slug, brand_name, house_number, status, published,
                                  plan, story, location, country, tags)
    values (_user_id, b.haus_slug, 'DRAPÉ', 7, 'active', true, 'haus',
            'Kleidung beginnt für uns mit Bewegung. Wir arbeiten mit der Spannung zwischen großzügigem Volumen und einer einzigen klaren Linie.',
            'Berlin', 'DE', array['Mode'])
    returning id into haus_id;
  else
    update public.designers set user_id = _user_id
     where id = haus_id and (user_id is null or user_id = _user_id);
  end if;

  if haus_id is null then return; end if;

  -- Hausseite freigeben, sobald die Spalte existiert (spaetere Migration).
  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='designers'
                and column_name='page_published_at') then
    execute 'update public.designers set page_published_at = coalesce(page_published_at, now()) where id = $1'
      using haus_id;
  end if;

  insert into public.products (designer_id, slug, name, world, price, image_url, status,
                               inventory_mode, stock_quantity, product_dna, height_cm, tags)
  values
    (haus_id, 'wool-coat', 'Wool Coat', 'Mode', 480, '/heft/assets/cutout-coat.webp', 'published',
     'made_to_order', 0,
     jsonb_build_object('kind','produkt','materials', jsonb_build_array('Wolle'),
       'heft', jsonb_build_object('cutout_url','/heft/assets/cutout-coat.webp','hoehe',3.08)),
     185, array['mantel']),
    (haus_id, 'curve-chair', 'Curve Chair', 'Interior', 720, '/heft/assets/cutout-chair.webp', 'published',
     'made_to_order', 0,
     jsonb_build_object('kind','produkt','materials', jsonb_build_array('Textil','Holz'),
       'heft', jsonb_build_object('cutout_url','/heft/assets/cutout-chair.webp','hoehe',1.85)),
     111, array['sessel']),
    (haus_id, 'traces-01', 'Traces / 01', 'Kunst', 0, '/heft/assets/cutout-art.webp', 'published',
     'made_to_order', 0,
     jsonb_build_object('kind','auftragsarbeit','materials', jsonb_build_array('Öl','Pigment'),
       'heft', jsonb_build_object('cutout_url','/heft/assets/cutout-art.webp','hoehe',2.48)),
     149, array['malerei'])
  on conflict (slug) do nothing;
end;
$fn$;

-- Vorhandene Konten nachziehen.
do $do$
declare u record;
begin
  for u in select id, email from auth.users
            where lower(email) in (select email from public.zugang_bootstrap)
  loop
    begin
      perform public.zugang_zuweisen(u.id, u.email);
    exception when others then
      insert into public.zugang_protokoll (email, fehler, detail) values (u.email, sqlerrm, sqlstate);
    end;
  end loop;
end $do$;
