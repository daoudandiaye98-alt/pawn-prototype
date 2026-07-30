-- Teil 21a: Das Gespräch findet auf der Seite statt.
-- Ablage für hochgeladene Stil-Referenzen je Nutzer (Fotos/Moodboards, die im
-- DNA-Gespräch geteilt wurden). Getrennt von user_memory.preferences, weil
-- Bilder eigene Objekte mit Beschreibung + Herkunft sind, die einzeln
-- gelöscht werden können — und weil Admins (Support/Analyse) mitlesen dürfen,
-- der einzelne Kunde-Chattext selbst aber privat bleibt (dort in
-- user_memory.preferences.dna_chat_verlauf, ohne Admin-Zugriff).
create table public.style_references (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  path text not null,
  beschreibung text,
  herkunft text not null default 'bild',
  created_at timestamptz not null default now()
);

create index style_references_user_idx on public.style_references (user_id, created_at desc);

alter table public.style_references enable row level security;

create policy "user reads own style_references" on public.style_references
  for select to authenticated using (auth.uid() = user_id);

create policy "user inserts own style_references" on public.style_references
  for insert to authenticated with check (auth.uid() = user_id);

create policy "user deletes own style_references" on public.style_references
  for delete to authenticated using (auth.uid() = user_id);

create policy "admin reads all style_references" on public.style_references
  for select to authenticated using (has_role(auth.uid(), 'admin'::app_role));
