-- Teil 33 — Die zweite Kartei: Markenbauen. Statt einer neuen Parallel-Tabelle wird die
-- bereits bestehende brand_knowledge (Migration 20260804101315, gespeist vom bislang
-- unverdrahteten pawn-jarvis-Modus wissen_markenaufbau und schon gelesen von studio-ai
-- "aufbau") um die für Teil 33 fehlenden Felder ergänzt: Quelle-Typ, Gültigkeitsvermutung
-- und ein active-Flag getrennt vom bestehenden approved-Redaktionsflag (approved = "darf
-- gezeigt werden", active = "gilt noch, wurde nicht durch eine neuere These ersetzt").
alter table public.brand_knowledge
  add column if not exists quelle_typ text not null default 'recherchiert',
  add column if not exists gueltigkeitsvermutung text,
  add column if not exists active boolean not null default true;

create index if not exists brand_knowledge_active_idx on public.brand_knowledge (active, approved, created_at desc);
