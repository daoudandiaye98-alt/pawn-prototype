-- Zugänge für Daouda + das Haus mit den drei Werken aus der Vorschau.
-- Selbsttragend: legt die Bootstrap-Tabelle an, falls sie fehlt. Mehrfach ausführbar.
-- Angewandt auf cnxtdcifkrdxvajaikxq am 11.09.2026, Version = Dateiname.

create table if not exists public.zugang_bootstrap (
  email     text primary key,
  rolle     app_role not null,
  haus_slug text,
  notiz     text
);
alter table public.zugang_bootstrap enable row level security;

insert into public.zugang_bootstrap (email, rolle, haus_slug, notiz) values
  ('pawnstudio.co@gmail.com', 'admin',    null,         'Admin-Zugang Daouda'),
  ('dodondiaye99@gmail.com',  'designer', 'demo-drape', 'Designer-Zugang Daouda, Haus DRAPE')
on conflict (email) do update
  set rolle = excluded.rolle, haus_slug = excluded.haus_slug, notiz = excluded.notiz;

create unique index if not exists user_roles_user_role_uniq on public.user_roles (user_id, role);

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
                                  page_published_at, plan, story, location, country)
    values (_user_id, b.haus_slug, 'DRAPÉ', 7, 'active', true, now(), 'haus',
            'Kleidung beginnt für uns mit Bewegung. Wir arbeiten mit der Spannung zwischen großzügigem Volumen und einer einzigen klaren Linie.',
            'Berlin', 'DE')
    returning id into haus_id;
  else
    update public.designers set user_id = _user_id
     where id = haus_id and (user_id is null or user_id = _user_id);
  end if;

  if haus_id is null then return; end if;

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

create or replace function public.zugang_bei_anmeldung()
returns trigger
language plpgsql
security definer
set search_path = public
as $tg$
begin
  perform public.zugang_zuweisen(new.id, new.email);
  return new;
end;
$tg$;

drop trigger if exists zugang_bootstrap_trigger on auth.users;
create trigger zugang_bootstrap_trigger
  after insert on auth.users
  for each row execute function public.zugang_bei_anmeldung();

do $do$
declare u record;
begin
  for u in select id, email from auth.users
            where lower(email) in (select email from public.zugang_bootstrap)
  loop
    perform public.zugang_zuweisen(u.id, u.email);
  end loop;
end $do$;
