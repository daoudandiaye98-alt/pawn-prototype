-- PART 51 Teil B — First Move Flow (/start): ein Zwischenspeicher für die drei Züge, bevor
-- ein echtes Haus entsteht, plus die eine Funktion, die am Ende ("Zug machen.") wirklich
-- veröffentlicht. Bewusst getrennt vom bestehenden Bewerbungsweg (/apply → designer_applications
-- → admin-geprüft → approve_designer()) — First Move überspringt die Prüfung ganz, siehe
-- CLAUDE.md-Auftrag PART 51: "Kein Zustand zwischen 'angefangen' und 'sichtbar' — live ist Default."

create table public.first_move_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  step text not null default 'zeigen' check (step in ('zeigen', 'bestaetigen', 'ziehen')),
  brand_name text,
  location text,
  country text not null default 'DE',
  about_text text,
  about_source text check (about_source in ('voice', 'chips')),
  -- works: [{ id, kind: 'original'|'print'|'auftragsarbeit'|'live_portrait', image_url,
  --           title, description, price_cents }]
  works jsonb not null default '[]'::jsonb,
  shipping_de_eu boolean not null default true,
  -- billing: { legal_name, address_line1, postal_code, city, country, tax_id, kleinunternehmer }
  billing jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.first_move_sessions is
  'PART 51 Teil B: Zwischenstand des First-Move-Flows (/start) vor der Veröffentlichung — verschwindet, sobald first_move_publish() daraus ein echtes Haus macht.';

alter table public.first_move_sessions enable row level security;

grant select, insert, update, delete on public.first_move_sessions to authenticated;
grant all on public.first_move_sessions to service_role;

create policy "eigene first-move-sitzung" on public.first_move_sessions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "admin liest first-move-sitzungen" on public.first_move_sessions
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create trigger trg_first_move_sessions_updated before update on public.first_move_sessions
  for each row execute function set_updated_at();

-- Die eine Funktion, die "Zug machen." wirklich ausführt: legt Haus + Werke live an, in einer
-- Transaktion, unter Wiederverwendung der bestehenden Bausteine (slugify(), designer_billing_profiles,
-- product_dna). SECURITY DEFINER, weil `designers` bewusst kein INSERT für gewöhnliche Nutzer
-- erlaubt (nur admin/service_role) — diese Funktion ist die einzige kontrollierte Ausnahme dafür,
-- exakt wie approve_designer() es für den Bewerbungsweg bereits ist. Läuft idempotent: ruft ein
-- Haus, das schon existiert, einfach nochmal seine eigenen Daten ab statt einen Fehler zu werfen —
-- ein doppelter Klick auf "Zug machen." darf nie ein zweites Haus anlegen.
create or replace function public.first_move_publish()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  sess record;
  existing_id uuid;
  existing_slug text;
  base_slug text;
  final_slug text;
  next_house_no integer;
  new_designer_id uuid;
  work jsonb;
  work_count integer;
  price numeric;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'auth_required');
  end if;

  select id, slug into existing_id, existing_slug from public.designers where user_id = uid;
  if existing_id is not null then
    delete from public.first_move_sessions where user_id = uid;
    return jsonb_build_object('ok', true, 'designer_id', existing_id, 'slug', existing_slug, 'already_existed', true);
  end if;

  select * into sess from public.first_move_sessions where user_id = uid;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_session');
  end if;
  if coalesce(trim(sess.brand_name), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'brand_name_required');
  end if;
  work_count := jsonb_array_length(sess.works);
  if work_count < 1 then
    return jsonb_build_object('ok', false, 'error', 'no_works');
  end if;

  -- Reihenfolge sichern: house_number wird wie in approve_designer() aus MAX+1 berechnet — ohne
  -- diesen Lock könnten zwei gleichzeitige "Zug machen."-Klicks dieselbe Nummer ziehen.
  perform pg_advisory_xact_lock(hashtext('designers_house_number'));
  select coalesce(max(house_number), 0) + 1 into next_house_no from public.designers;

  base_slug := public.slugify(sess.brand_name);
  if base_slug = '' then base_slug := 'haus'; end if;
  final_slug := base_slug;
  while exists (select 1 from public.designers where slug = final_slug) loop
    final_slug := base_slug || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.designers
    (user_id, slug, brand_name, location, country, story, status, house_number, published, plan, shipping_rates)
  values
    (uid, final_slug, sess.brand_name, sess.location, coalesce(nullif(sess.country, ''), 'DE'), sess.about_text,
     'active', next_house_no, true, 'haus',
     case when sess.shipping_de_eu
       then '{"inland":{"flat_cents":490,"free_from_cents":null},"eu":{"flat_cents":990,"free_from_cents":null},"world":{"flat_cents":1490,"free_from_cents":null}}'::jsonb
       else '{}'::jsonb
     end)
  returning id into new_designer_id;

  -- Rechtstexte (Teil B, Zug 2): Vorschlag aus Kontodaten — nichts erfunden, was fehlt bleibt
  -- leer und ist unter /studio/versand jederzeit nachtragbar.
  insert into public.designer_billing_profiles
    (designer_id, legal_name, address_line1, postal_code, city, country, tax_id, kleinunternehmer)
  values
    (new_designer_id,
     coalesce(nullif(sess.billing->>'legal_name', ''), sess.brand_name),
     nullif(sess.billing->>'address_line1', ''),
     nullif(sess.billing->>'postal_code', ''),
     nullif(sess.billing->>'city', ''),
     coalesce(nullif(sess.billing->>'country', ''), sess.country, 'DE'),
     nullif(sess.billing->>'tax_id', ''),
     coalesce((nullif(sess.billing->>'kleinunternehmer', ''))::boolean, true));

  for work in select value from jsonb_array_elements(sess.works) as value
  loop
    price := coalesce((work->>'price_cents')::numeric, 0) / 100.0;
    insert into public.products
      (designer_id, name, slug, world, price, description, image_url, status, product_dna)
    values
      (new_designer_id,
       coalesce(nullif(work->>'title', ''), sess.brand_name),
       public.slugify(coalesce(nullif(work->>'title', ''), sess.brand_name)) || '-' || substr(md5(random()::text), 1, 6),
       'Kunst',
       price,
       nullif(work->>'description', ''),
       nullif(work->>'image_url', ''),
       'published',
       jsonb_build_object('kind', coalesce(nullif(work->>'kind', ''), 'original')));
  end loop;

  delete from public.first_move_sessions where user_id = uid;

  return jsonb_build_object('ok', true, 'designer_id', new_designer_id, 'slug', final_slug, 'already_existed', false);
end;
$$;

revoke all on function public.first_move_publish() from public;
grant execute on function public.first_move_publish() to authenticated;
