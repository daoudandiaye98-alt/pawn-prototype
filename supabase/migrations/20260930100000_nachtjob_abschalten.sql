-- M6 — der Nachtjob feuert an eine fremde Domain.
--
-- BEFUND, an cnxtdcifkrdxvajaikxq gemessen am 11.09.2026: cron.job Nummer 1,
-- `compute-trends-daily`, Zeitplan `15 3 * * *`, AKTIV. Sie schickt jede Nacht ein
-- POST an
--     https://rnakubexbqfgfciynqpt.supabase.co/functions/v1/compute-trends
-- also an das GELOESCHTE alte Projekt, und traegt dessen anon-JWT im Kopf mit. Die
-- Function `compute-trends` liegt nicht einmal im Repo.
--
-- Zwei Gruende, das abzuschalten statt umzubiegen: erstens zeigt das Ziel auf eine
-- Domain, die PAWN nicht mehr gehoert — wer sie je uebernimmt, bekommt jede Nacht
-- einen Anruf mit einem Schluessel im Kopf. Zweitens gibt es nichts, worauf man es
-- umbiegen koennte: die Function existiert nirgends.
--
-- WIEDER ANLEGEN erst, wenn `compute-trends` im Repo liegt UND ausgerollt ist — als
-- eigene Migration, mit der Adresse des NEUEN Projekts und ohne Schluessel im
-- Klartext (das Geheimnis gehoert in die Function, nicht in den Zeitplan).

do $$
declare n int;
begin
  select count(*) into n from cron.job where jobname = 'compute-trends-daily';
  if n > 0 then
    perform cron.unschedule('compute-trends-daily');
    raise notice 'compute-trends-daily abgeschaltet';
  else
    raise notice 'compute-trends-daily war nicht vorhanden — nichts zu tun';
  end if;
end $$;
