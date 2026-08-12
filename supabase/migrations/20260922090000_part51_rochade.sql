-- Die Rochade: eine Künstlerin speist ihre bereits existierende Website, ein paar Screenshots
-- oder ihr Instagram-Handle in PAWN ein — First Move (Zug 1) kommt vorbefüllt zurück, statt mit
-- leerem Blatt zu beginnen. Keine neue Wissens-Ablage: der extrahierte DNA-Datensatz liegt im
-- bereits bestehenden Zwischenspeicher first_move_sessions, und wandert bei "Zug machen." in die
-- ebenfalls bereits bestehende designers.brand_dna (dieselbe Spalte, die distill-brand-dna,
-- generate-signatures und die Kuratierung längst lesen) — keine neue Tabelle.

alter table public.first_move_sessions
  add column if not exists rochade jsonb not null default '{}'::jsonb;

comment on column public.first_move_sessions.rochade is
  'PART 51 Rochade: { source_type: url|screenshots|instagram, source_ref: text, consent_at: timestamptz, dna: {...} } — Herkunftsvermerk + destillierte Stil-DNA aus dem importierten Material, bis first_move_publish() sie in designers.brand_dna überführt.';

-- first_move_publish() neu: übernimmt zusätzlich die Rochade-DNA (falls vorhanden) in
-- designers.brand_dna.rochade — dieselbe Spalte wie überall sonst im Haus, kein neues Feld
-- anderswo. Rest der Funktion unverändert zur vorherigen Fassung (Teil B).
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
  rochade_dna jsonb;
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

  perform pg_advisory_xact_lock(hashtext('designers_house_number'));
  select coalesce(max(house_number), 0) + 1 into next_house_no from public.designers;

  base_slug := public.slugify(sess.brand_name);
  if base_slug = '' then base_slug := 'haus'; end if;
  final_slug := base_slug;
  while exists (select 1 from public.designers where slug = final_slug) loop
    final_slug := base_slug || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  rochade_dna := case when sess.rochade ? 'dna' then
    jsonb_build_object(
      'quelle', sess.rochade->>'source_type',
      'herkunft', sess.rochade->>'source_ref',
      'uebernommen_am', sess.rochade->>'consent_at',
      'merkmale', sess.rochade->'dna'
    )
  else null end;

  insert into public.designers
    (user_id, slug, brand_name, location, country, story, status, house_number, published, plan, shipping_rates, brand_dna)
  values
    (uid, final_slug, sess.brand_name, sess.location, coalesce(nullif(sess.country, ''), 'DE'), sess.about_text,
     'active', next_house_no, true, 'haus',
     case when sess.shipping_de_eu
       then '{"inland":{"flat_cents":490,"free_from_cents":null},"eu":{"flat_cents":990,"free_from_cents":null},"world":{"flat_cents":1490,"free_from_cents":null}}'::jsonb
       else '{}'::jsonb
     end,
     case when rochade_dna is not null then jsonb_build_object('rochade', rochade_dna) else '{}'::jsonb end)
  returning id into new_designer_id;

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
