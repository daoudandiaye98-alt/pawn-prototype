# ZUG C — Das Fashion-Gehirn

Ein zusammenhängender Datenstrom: **Ontologie → Signale → DNA → Trends → Gedächtnis**. Alles typecheck-sauber, RLS-korrekt, ehrlich in Prognosen.

## 1. Wissensbasis (Fashionpedia-Ontologie)

**Migration 1 — `fashion_ontology`:**
- Enum `ontology_kind`: `category | silhouette | material | color | attribute | style`
- Spalten: `id uuid pk`, `term text unique`, `kind ontology_kind`, `world text[] default '{mode}'`, `parent_term text null`, `synonyms text[] default '{}'`, `created_at`
- GRANT anon+authenticated SELECT; service_role ALL; admin write via policy
- **Seed 120+ Terme deutsch/englisch** in derselben Migration (Kategorien Mode/Interior/Kunst, Silhouetten, Materialien, Farben, Attribute)

**Verwendung:**
- `src/features/ontology/useOntology.ts` — lädt einmal, cached in-memory; `suggest(input)` und `normalize(rawTag)` mit Synonym-Match
- **Produkt-Editor** (`StudioProducts.tsx`): Tag-Input mit Autocomplete-Dropdown aus Ontologie; freie Eingabe wird auf ontology-Term normalisiert
- **`pawn-chat/parseSignal`**: baut Term-Index aus Ontologie (over-fetch beim Function-Start); Nutzertext-Tokens → matched terms mit `kind` — persistiert `taste_signal` mit `{term, kind, world}` statt Freitext
- **`/admin/ki`** Tab "Wissensbasis": Term-Liste, Suche, Anlegen, Synonyme editieren (nur admin)

## 2. Trend-Engine

**Migration 2 — `trend_snapshots`:**
- `id, day date, term text, world text, views int, likes int, saves int, purchases int, score numeric, created_at`
- Unique `(day, term, world)`; RLS admin read; service write
- SQL-Function `public.trend_momentum(_world text)` returns table: term, ema7 numeric, slope numeric, momentum text, forecast14 numeric — berechnet 7-Tage-EMA je Term + lineare Fortschreibung

**Edge Function `compute-trends`:**
- Aggregiert der letzten 24h aus `domain_events` (views/saves aus payload), `orders` (purchases via order-items → product tags → ontology-normalized), `taste_signals`
- Für jeden term×world: score = views + likes*3 + saves*4 + purchases*10
- Upsert in `trend_snapshots` für today
- Ruft `merge-integrations` nicht — reiner Batch, gibt JSON mit Zusammenfassung zurück

**pg_cron** (via `supabase--insert` da user-spezifisch): täglich 03:00 UTC via `net.http_post` mit anon key.

**UI:**
- `/admin/trends` (neue Seite in AdminShell): Welt-Tabs (Mode/Interior/Kunst) → Termliste mit Score, Mini-SVG-Sparkline (7 Tage), Momentum-Pfeil (↑ →↓), Forecast-Spalte; Button "Jetzt neu berechnen"
- Studio-Copilot (`studio-ai`): system-prompt bekommt Top-Momentum-Terme der Designer-Welten injiziert; Wochenspiegel-Antwort nutzt sie
- `pawn-chat`: neue Intent-Erkennung "was ist gefragt/trend" → antwortet mit Top-3 Momentum-Terme + passende Produkte

## 3. Lernendes Gedächtnis

**Migration 3 — `user_memory`:**
- `user_id uuid pk references auth.users`, `preferences jsonb default '{}'` (Struktur: `{ category: {mantel: 3, blazer: 1}, material: {...}, ... }`), `facts jsonb default '[]'` (max 20 Einträge `{fact, at}`), `updated_at`
- RLS: owner select/update/delete; service_role ALL
- Trigger `set_updated_at`

**pawn-chat Erweiterung:**
- Bei Session-Ende (letzte Assistant-Message pro Request): kurzer zweiter LLM-Call "extrahiere Präferenzen (ontology-Terme mit +1/+2) und ggf. einen Merksatz zu Anlass". Ergebnis: `preferences` mergen (kappen bei sinnvoller Größe), `facts` prepend + kappen auf 20
- Beim Start jeder Session: `user_memory` lesen → System-Prompt bekommt "Was PAWN sich merkt"-Block
- Persist nur wenn eingeloggt (`user_id`)

**Frontend:**
- `usePersonalization`: lädt zusätzlich `user_memory.preferences` bei Login und merged in aggregiertes Profil (Boost für gespeicherte Präferenzen)
- `/dna`-Seite: neue Sektion "PAWN erinnert sich" — jede fact-Karte mit ✕-Button → Event `ai.memory_deleted` + Fact aus Array entfernen
- `delete-account`-Function: zusätzlich `user_memory` löschen

## 4. Qualität & Ehrlichkeit

- Nach Migrationen: `compute-trends` einmal manuell ausführen → echte (auch dünne) Snapshots
- `/admin/trends` leerer Zustand: „Noch zu wenig Daten für Prognosen — der Strom wächst mit jedem Besucher."
- Forecast-Labels konsequent „Prognose auf Basis des Verlaufs" — nie Gewissheit
- Kein Mock-Datenpunkt

## Technische Details

**Neue Dateien:**
- `src/features/ontology/useOntology.ts`
- `src/features/ontology/TagInput.tsx` (Autocomplete-Input)
- `src/pages/admin/AdminTrends.tsx`
- `src/pages/admin/tabs/OntologyManager.tsx` (in AdminKI eingebunden)
- `supabase/functions/compute-trends/index.ts`
- 3 Migrationen (Ontologie+Seed, Trends+View, Memory)

**Editierte Dateien:**
- `supabase/functions/pawn-chat/index.ts` — parseSignal mit Ontologie, Memory read/write, Trend-Intent
- `supabase/functions/studio-ai/index.ts` — Trend-Injection
- `supabase/functions/delete-account/index.ts` — user_memory cleanup
- `src/pages/studio/StudioProducts.tsx` — TagInput einsetzen
- `src/pages/admin/AdminKI.tsx` — Tab Wissensbasis
- `src/pages/DNA.tsx` — "PAWN erinnert sich"
- `src/features/personalization/index.tsx` — user_memory-Merge
- `src/App.tsx` — Route `/admin/trends`
- `src/components/pawn/AdminShell.tsx` — Nav-Eintrag Trends

## Ausführungsreihenfolge

1. Migration 1 (Ontologie + Seed) → warten auf Approval → Types-Regen
2. Migration 2 (Trends + Funktion) → Approval → Types-Regen
3. Migration 3 (Memory) → Approval → Types-Regen
4. Edge Function `compute-trends` + einmal ausführen
5. Edge Function `pawn-chat`/`studio-ai`/`delete-account` erweitern
6. Frontend: Ontologie-Hook + TagInput → Produkt-Editor
7. AdminTrends-Seite + AdminKI-Tab + Route/Nav
8. DNA-Seite Memory-Sektion + Personalization-Merge
9. pg_cron einrichten (via insert-tool, wegen anon-key)
10. Typecheck, Selbsttest

Umfang groß, aber jede Ebene liefert eigenständigen Nutzen — auch bei knapper Datenlage ehrliche Zustände.
