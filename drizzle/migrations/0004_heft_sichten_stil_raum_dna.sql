create or replace view public.heft_haeuser
with (security_invoker = true) as
select id, slug, brand_name, house_number, status, published, page_published_at, plan, brand_dna,
       story, manifesto, quote, quote_role, collection_title, location, country, website, instagram, tags,
       hero_image_url, avatar_url, banner_url, portrait_url, atelier_image_url, atelier_caption,
       is_featured, verkaufsbereit
from public.designers
where status = 'active' and published = true;

create or replace view public.heft_produkte
with (security_invoker = true) as
select p.id, p.slug, p.name, p.world, p.price, p.image_url, p.description, p.designer_note, p.product_dna,
       p.size_variants, p.measurements, p.material_composition, p.inventory_mode, p.stock_quantity, p.lead_time_days,
       p.tags, p.status, p.height_cm, p.width_cm, p.length_cm, p.made_in, p.care_instructions, p.edition_info,
       p.sustainability_note, p.vat_rate, p.designer_id, p.created_at
from public.products p
join public.designers d on d.id = p.designer_id
where p.status = 'published' and d.status = 'active' and d.published = true;

grant select on public.heft_haeuser, public.heft_produkte to anon, authenticated;

comment on view public.heft_haeuser is 'Öffentliche Hausdaten fürs Heft (Spaltenmaske, keine Stripe-/Kontospalten).';
comment on view public.heft_produkte is 'Öffentliche Werke fürs Heft; nur veröffentlichte Werke aktiver, veröffentlichter Häuser.';

create table if not exists public.kunden_stil (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  welt         text check (welt in ('mode','interior','kunst')),
  richtung     text,
  form         text,
  fuer_wen     text check (fuer_wen is null or fuer_wen in ('Damen','Herren','Beides')),
  foto_befund  jsonb,
  quelle       text not null default 'heft-quiz',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.kunden_stil enable row level security;

grant select, insert, update, delete on public.kunden_stil to authenticated;
grant all on public.kunden_stil to service_role;

drop policy if exists "kunde liest eigenen stil" on public.kunden_stil;
create policy "kunde liest eigenen stil" on public.kunden_stil
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "kunde schreibt eigenen stil" on public.kunden_stil;
create policy "kunde schreibt eigenen stil" on public.kunden_stil
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "kunde aendert eigenen stil" on public.kunden_stil;
create policy "kunde aendert eigenen stil" on public.kunden_stil
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "kunde loescht eigenen stil" on public.kunden_stil;
create policy "kunde loescht eigenen stil" on public.kunden_stil
  for delete to authenticated using (auth.uid() = user_id);

create or replace function public.kunden_stil_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists kunden_stil_touch on public.kunden_stil;
create trigger kunden_stil_touch before update on public.kunden_stil for each row execute function public.kunden_stil_touch();

comment on table public.kunden_stil is 'Stilberatung des Hefts: Welt/Richtung/Form je Konto.';

alter table public.customer_measurements
  add column if not exists raum jsonb;

comment on column public.customer_measurements.raum is 'Heft-Raummaße {wand, hoehe, flaeche, licht, abstand} für Interior/Kunst; room_note bleibt der lesbare Satz.';

alter table public.products drop constraint if exists products_product_dna_heft_check;
alter table public.products add constraint products_product_dna_heft_check check (
  product_dna is null
  or not (product_dna ? 'heft')
  or (
    jsonb_typeof(product_dna->'heft') = 'object'
    and (not (product_dna->'heft' ? 'hoehe') or (product_dna->'heft'->>'hoehe')::numeric between 1.2 and 3.4)
  )
);