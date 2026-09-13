-- C5 — zuglogik_berechnen(): wie bewegt sich diese Person durch das Heft?
-- Die Regel steht in SQL, nicht im Sprachmodell. Unter 20 Ereignissen gibt es
-- keine Aussage und keinen Schreibvorgang — fünf Klicks sind geraten, nicht gemessen.
create or replace function public.zuglogik_berechnen()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _gesamt int;
  _welten int;
  _merken int;
  _kauf int;
  _schnitt_ms numeric;
  _satz text;
begin
  if _uid is null then
    return null;
  end if;

  select count(*) into _gesamt from public.begleiter_ereignisse where user_id = _uid;
  if _gesamt < 20 then
    return null;
  end if;

  select
    count(distinct nullif(daten->>'welt','')) filter (where daten ? 'welt'),
    count(*) filter (where ereignis = 'merken'),
    count(*) filter (where ereignis = 'kauf'),
    coalesce(avg(nullif(daten->>'ms','')::numeric) filter (where ereignis = 'verweilen'), 0)
  into _welten, _merken, _kauf, _schnitt_ms
  from public.begleiter_ereignisse
  where user_id = _uid;

  if _merken >= 5 and _kauf = 0 then
    _satz := 'Merkt viel, kauft nie — die Liste wächst schneller als die Tasche.';
  elsif _welten >= 3 then
    _satz := 'Springt zwischen den Welten — Mode, Interior und Kunst liegen nebeneinander offen.';
  elsif _schnitt_ms >= 15000 then
    _satz := 'Liest lange — bleibt bei einem Werk, bevor das nächste drankommt.';
  else
    _satz := 'Blättert schnell — viele Seiten, kurze Blicke.';
  end if;

  insert into public.kunden_archetyp (user_id, zuglogik, updated_at)
  values (_uid, _satz, now())
  on conflict (user_id) do update
    set zuglogik = excluded.zuglogik,
        updated_at = now();

  return _satz;
end;
$$;

revoke execute on function public.zuglogik_berechnen() from public, anon;
grant execute on function public.zuglogik_berechnen() to authenticated;