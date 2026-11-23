SET client_min_messages = notice;
-- Umzug · Nachlauf — läuft in derselben Transaktion wie das Einspielen.
-- Platzhalter füllt einspielen.sh: __ALT_URL__ (https://<alt>.supabase.co),
-- __API_NEU__ (https://api.pawn.vision), __ANON_NEU__ (neuer öffentlicher Schlüssel).

-- 1 · Alle Takt-Aufträge AUS. Angeschaltet wird erst nach dem Umschalten und
--     nachdem sie im alten System aus sind — sonst laufen Mails doppelt raus.
update cron.job set active = false;

-- 2 · Takt-Aufträge zeigen auf die eigene Edge Runtime (intern, ohne Umweg über das Netz).
update cron.job
set command = replace(command, '__ALT_URL__/functions/v1/', 'http://api-gw:8000/functions/v1/')
where command like '%__ALT_URL__%';

-- 3 · Alte Adressen in den Daten → neue Adresse. Gilt für jede Text- und jsonb-Spalte in public.
do $$
declare
  spalte record;
  n bigint;
  gesamt bigint := 0;
begin
  for spalte in
    select c.table_schema, c.table_name, c.column_name, c.data_type
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.data_type in ('text', 'character varying', 'jsonb', 'json', 'ARRAY')
  loop
    if spalte.data_type in ('text', 'character varying') then
      execute format('update %I.%I set %I = replace(%I, %L, %L) where %I like %L',
        spalte.table_schema, spalte.table_name, spalte.column_name, spalte.column_name,
        '__ALT_URL__', '__API_NEU__', spalte.column_name, '%__ALT_URL__%');
    elsif spalte.data_type = 'jsonb' then
      execute format('update %I.%I set %I = replace(%I::text, %L, %L)::jsonb where %I::text like %L',
        spalte.table_schema, spalte.table_name, spalte.column_name, spalte.column_name,
        '__ALT_URL__', '__API_NEU__', spalte.column_name, '%__ALT_URL__%');
    elsif spalte.data_type = 'json' then
      execute format('update %I.%I set %I = replace(%I::text, %L, %L)::json where %I::text like %L',
        spalte.table_schema, spalte.table_name, spalte.column_name, spalte.column_name,
        '__ALT_URL__', '__API_NEU__', spalte.column_name, '%__ALT_URL__%');
    else -- text[]
      begin
        execute format('update %I.%I set %I = replace(%I::text, %L, %L)::text[] where %I::text like %L',
          spalte.table_schema, spalte.table_name, spalte.column_name, spalte.column_name,
          '__ALT_URL__', '__API_NEU__', spalte.column_name, '%__ALT_URL__%');
      exception when others then null; -- Arrays anderer Typen bleiben unberührt
      end;
    end if;
    get diagnostics n = row_count;
    gesamt := gesamt + n;
    if n > 0 then raise notice 'umgeschrieben: %.% (%) → % Zeilen', spalte.table_name, spalte.column_name, spalte.data_type, n; end if;
  end loop;
  raise notice 'Adressen umgeschrieben: % Zeilen insgesamt', gesamt;
end $$;

-- 4 · Signierte Bild-Adressen tragen eine Signatur des alten Projekts und wären
--     hier ungültig. Liegt das Bild in einem öffentlichen Eimer, wird daraus die
--     dauerhafte öffentliche Adresse (dieselbe Datei, ohne Ablaufdatum).
do $$
declare
  spalte record;
  oeffentlich text;
  n bigint;
begin
  select string_agg(id, '|') into oeffentlich from storage.buckets where public;
  if oeffentlich is null then return; end if;
  for spalte in
    select c.table_name, c.column_name, c.data_type
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.data_type in ('text', 'character varying', 'jsonb')
  loop
    if spalte.data_type = 'jsonb' then
      execute format($q$update public.%I set %I = regexp_replace(%I::text, '/storage/v1/object/sign/(%s)/([^?"\s]+)\?token=[^"&\s]+', '/storage/v1/object/public/\1/\2', 'g')::jsonb where %I::text like '%%/object/sign/%%'$q$,
        spalte.table_name, spalte.column_name, spalte.column_name, oeffentlich, spalte.column_name);
    else
      execute format($q$update public.%I set %I = regexp_replace(%I, '/storage/v1/object/sign/(%s)/([^?"\s]+)\?token=[^"&\s]+', '/storage/v1/object/public/\1/\2', 'g') where %I like '%%/object/sign/%%'$q$,
        spalte.table_name, spalte.column_name, spalte.column_name, oeffentlich, spalte.column_name);
    end if;
    get diagnostics n = row_count;
    if n > 0 then raise notice 'signierte Adressen → öffentlich: %.% → % Zeilen', spalte.table_name, spalte.column_name, n; end if;
  end loop;
end $$;

-- 5 · Datenbank-Funktionen, die die alte Adresse fest eingebaut haben.
do $$
declare
  f record;
  def text;
begin
  for f in
    select p.oid, n.nspname, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosrc like '%__ALT_URL__%'
  loop
    def := pg_get_functiondef(f.oid);
    def := replace(def, '__ALT_URL__/functions/v1/', 'http://api-gw:8000/functions/v1/');
    def := replace(def, '__ALT_URL__', '__API_NEU__');
    execute def;
    raise notice 'Funktion umgestellt: %.%', f.nspname, f.proname;
  end loop;
end $$;

-- 6 · Realtime: die Veröffentlichung muss die Tabellen kennen, die das Frontend live liest.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- 7 · Konten: Die Anmeldung (GoTrue) liest diese Felder als Text und bricht bei NULL ab
--     („converting NULL to string is unsupported“, gemessen im Probelauf). Per SQL
--     angelegte Konten tragen oft NULL — hier werden sie zu leeren Texten.
update auth.users set
  confirmation_token         = coalesce(confirmation_token, ''),
  recovery_token             = coalesce(recovery_token, ''),
  email_change_token_new     = coalesce(email_change_token_new, ''),
  email_change               = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change               = coalesce(phone_change, ''),
  phone_change_token         = coalesce(phone_change_token, ''),
  reauthentication_token     = coalesce(reauthentication_token, '')
where confirmation_token is null or recovery_token is null or email_change_token_new is null or email_change is null
   or email_change_token_current is null or phone_change is null or phone_change_token is null or reauthentication_token is null;
