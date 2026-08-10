-- Part 38 AP2 — designers.weekly_impulse existierte bereits (per AUFTRAG als wiederzuverwendendes
-- Feld genannt), war aber als boolean angelegt und nirgends im Code gelesen oder geschrieben —
-- ein totes Feld. Ein Wissens-Impuls ist ein kurzer Satz, kein Schalter: das Feld wird auf text
-- umgestellt, um den tatsächlich beabsichtigten Zweck (ein kurzer, DNA-passender Wissens-Impuls
-- pro Woche) zu tragen. Unbedenklich, weil das Feld verifiziert nirgends gelesen/geschrieben wird.
alter table public.designers alter column weekly_impulse drop default;
alter table public.designers alter column weekly_impulse type text using null;
alter table public.designers alter column weekly_impulse set default null;

alter table public.designers add column if not exists weekly_impulse_at timestamptz;
