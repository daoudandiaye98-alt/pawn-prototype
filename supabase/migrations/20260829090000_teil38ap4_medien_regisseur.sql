-- Teil 38 AP4: Medien — Fehler beheben + PAWN als Regisseur.
-- Ermöglicht poll-broll einen einmaligen automatischen Neuversuch bei vermutlich
-- vorübergehenden Fehlern, ein korrektes video_dna (Signatur + echte Länge statt immer
-- "5s, keine Signatur"), und PAWNs eigene strukturelle Einschätzung direkt nach der Erzeugung.

alter table public.generation_requests
  add column if not exists retry_count integer not null default 0,
  add column if not exists signature_id uuid references public.house_signatures(id) on delete set null,
  add column if not exists duration_s integer;

alter table public.video_assets
  add column if not exists regisseur_verdict jsonb;

comment on column public.generation_requests.retry_count is
  'Teil 38 AP4: wie oft dieser Auftrag nach einem vermutlich vorübergehenden Fehler automatisch neu gestartet wurde (höchstens 1).';
comment on column public.generation_requests.signature_id is
  'Teil 38 AP4: welche Haus-Signatur (falls gewählt) diesem Auftrag zugrunde lag — damit poll-broll das echte video_dna schreiben kann statt immer null.';
comment on column public.generation_requests.duration_s is
  'Teil 38 AP4: die tatsächlich angeforderte Länge in Sekunden (5 oder 10) — vorher schrieb poll-broll immer 5 ins video_dna, auch bei 10s-Aufnahmen.';
comment on column public.video_assets.regisseur_verdict is
  'Teil 38 AP4: PAWNs eigene strukturelle Einschätzung direkt nach der Erzeugung — {passt: boolean, punkte: string[], iterationsvorschlag: string}.';
