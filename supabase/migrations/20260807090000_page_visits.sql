-- Teil 20 (Vorlauf): Verweildauer + Rückkehrer je Besucher:in — ohne das bleibt "3 Mal
-- zurückgekehrt" oder "38 Sekunden angesehen" erfunden. products.view_count (Teil 16c)
-- zählt nur anonym insgesamt und trägt keine Wiederkehr-Information; hier kommt die
-- Zuordnung zum eingeloggten Nutzer dazu (nur eingeloggt — anonymes Stöbern bleibt
-- ungezählt, wie schon bei der Personalisierung selbst).
create table public.page_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('designer', 'product')),
  target_id uuid not null,
  visit_count int not null default 1,
  dwell_seconds int not null default 0,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create unique index page_visits_user_target_idx on public.page_visits (user_id, target_type, target_id);
create index page_visits_target_idx on public.page_visits (target_type, target_id);

alter table public.page_visits enable row level security;

create policy "user reads own page_visits" on public.page_visits
  for select to authenticated
  using (auth.uid() = user_id);

create policy "admin reads all page_visits" on public.page_visits
  for select to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));

-- Ein Aufruf pro Seitenaufruf: legt die Zeile beim ersten Mal an, zählt sonst hoch.
-- SECURITY DEFINER, weil ein Besucher nie eine fremde Zeile lesen/schreiben soll — nur
-- diese eine, über auth.uid() festgelegt, kein Parameter dafür.
create or replace function public.record_page_visit(p_target_type text, p_target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_target_type not in ('designer', 'product') then
    return;
  end if;
  insert into public.page_visits (user_id, target_type, target_id, visit_count, first_seen_at, last_seen_at)
  values (auth.uid(), p_target_type, p_target_id, 1, now(), now())
  on conflict (user_id, target_type, target_id) do update set
    visit_count = page_visits.visit_count + 1,
    last_seen_at = now();
end;
$$;
revoke all on function public.record_page_visit(text, uuid) from public;
grant execute on function public.record_page_visit(text, uuid) to authenticated;

-- Heartbeat aus dem Frontend (alle ~20s solange die Seite sichtbar ist) statt eines
-- unzuverlässigen beforeunload-Events. Gedeckelt auf 5 Minuten je Aufruf gegen offene
-- Tabs im Hintergrund.
create or replace function public.add_dwell_seconds(p_target_type text, p_target_id uuid, p_seconds int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_target_type not in ('designer', 'product') or p_seconds <= 0 or p_seconds > 300 then
    return;
  end if;
  update public.page_visits
  set dwell_seconds = dwell_seconds + p_seconds, last_seen_at = now()
  where user_id = auth.uid() and target_type = p_target_type and target_id = p_target_id;
end;
$$;
revoke all on function public.add_dwell_seconds(text, uuid, int) from public;
grant execute on function public.add_dwell_seconds(text, uuid, int) to authenticated;

-- Aggregierte Sicht je Produkt für den Designer selbst (Teil 20b: "welche Stücke Klicks
-- bringen, welche lange angesehen und trotzdem nicht gekauft werden") — absichtlich ohne
-- einzelne user_id in der Rückgabe, ein Designer sieht nie, WER genau geschaut hat.
create or replace function public.designer_product_engagement(p_designer_id uuid)
returns table (product_id uuid, total_visits bigint, unique_visitors bigint, avg_dwell_seconds numeric, returning_visitors bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (has_role(auth.uid(), 'admin'::app_role) or exists (
    select 1 from public.designers d where d.id = p_designer_id and d.user_id = auth.uid()
  )) then
    raise exception 'not_authorized';
  end if;
  return query
    select pv.target_id, sum(pv.visit_count), count(distinct pv.user_id)::bigint,
           avg(nullif(pv.dwell_seconds, 0)), count(*) filter (where pv.visit_count > 1)::bigint
    from public.page_visits pv
    join public.products p on p.id = pv.target_id and p.designer_id = p_designer_id
    where pv.target_type = 'product'
    group by pv.target_id;
end;
$$;
revoke all on function public.designer_product_engagement(uuid) from public;
grant execute on function public.designer_product_engagement(uuid) to authenticated;
