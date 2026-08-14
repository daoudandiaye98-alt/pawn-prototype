# Deploy-Paket — eine Liste, eine Reihenfolge

Stand: PR #165 (Zweig `claude/pawn-prototype-admin-structure-o4p87a`).

Alles, was in diesem Zweig steckt und **nicht** über Git allein live geht, steht
hier in genau der Reihenfolge, in der es angewandt werden muss. Nichts davon
passiert automatisch: Migrationen und Edge Functions gehen nur über den
Lovable-Agenten.

**Die eine Regel für die Reihenfolge:** erst die Datenbank, dann die Functions.
Eine Function, die auf eine noch nicht existierende Tabelle greift, scheitert
sauber — aber sie scheitert.

---

## Schritt 1 — Migrationen, in dieser Reihenfolge

| # | Datei | Was sie tut | Reversibel |
|---|---|---|---|
| 1 | `supabase/migrations/20260926090000_plan_beispiel_freigabe.sql` | `plan_beispiel` auf `media_assets` und `video_assets`, `designers.intern` mit Backfill, drei Trigger (interne Häuser ausgeschlossen, nur Admins setzen Beispiele) | ja — Spalten und Trigger einzeln entfernbar |
| 2 | `supabase/migrations/20260927090000_rochade_warteschlange.sql` | Vier Tabellen der langen Rochade (`rochade_auftraege`, `rochade_seiten`, `rochade_kandidaten`, `rochade_bilder`), RLS, vier RPCs, ein pg_cron-Job (`rochade-aufraeumen`, alle 10 Minuten) | ja — nur neue Objekte, nichts Bestehendes wird verändert |

Hinweis zu Datei 1: Sie hieß im Zweig zuerst `20260814140000_*` und wäre damit
**mitten zwischen** bereits angewandten Migrationen gelandet. Umbenannt auf
`20260926090000_*`, damit sie hinten in der Reihe steht. Wer die alte Datei noch
irgendwo liegen hat: die ist dieselbe, nur unter altem Namen.

Beide Migrationen sind additiv. Keine bestehende Spalte wird gelöscht, kein
bestehender Constraint verschärft.

---

## Schritt 2 — Edge Functions, in dieser Reihenfolge

| # | Function | Warum |
|---|---|---|
| 1 | `haus-rochade` | **Offen seit PR #163.** Speichert Werkbilder als Bucket-Pfad statt als 365-Tage-URL. Ohne diesen Deploy laufen alle über die Rochade importierten Werkbilder nach einem Jahr ab. Braucht keine der neuen Tabellen — kann als Erstes raus. |
| 2 | `rochade-import` | **Neu.** Der Arbeiter der langen Rochade. Braucht Migration 2. |

Die Dateien unter `supabase/functions/_shared/` (`rochadeSicherheit.ts`,
`rochadeAdapter.ts`, `rochadeBild.ts`, `rochadeDeutung.ts`,
`rochadeTrockenlauf.ts`, `rochade.test.ts`, `rochade-fixtures/*`) sind kein
eigener Deploy — sie werden mit den beiden Functions oben mitgebündelt.

### Was `rochade-import` braucht

- **Secrets:** `ANTHROPIC_API_KEY` (für die Deutung, Schritt 5),
  `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (für den Selbstaufruf).
  Alle drei existieren bereits — nichts Neues anzulegen.
- **Bucket:** `designer-media`, existiert.
- **Ohne `ANTHROPIC_API_KEY`** läuft der Import trotzdem durch: die Werke landen
  am Lichttisch, nur ohne Welt-Zuordnung. Es steht dann ein Satz dazu da.

---

## Schritt 3 — nach dem Deploy prüfen

1. `/studio/werke/rochade` öffnen, eine eigene Seite eintragen, Häkchen setzen,
   „Seite holen". Der Stand muss sich alle sechs Sekunden bewegen.
2. `select public.rochade_aufraeumen();` einmal von Hand — muss ein JSON mit
   fünf Zählern zurückgeben, alle 0 bei frischem Stand.
3. `select * from cron.job where jobname = 'rochade-aufraeumen';` — eine Zeile.
4. `/admin/archiv` öffnen: die Sektion „Plan-Beispiele" muss erscheinen und je
   Video eine Stufe setzen lassen.

---

## Was NICHT deployt werden muss

Alles Übrige in diesem Zweig ist Frontend und geht über Git von selbst live:
Boutique-Weg und Preis-Schieber (Teil Q1–Q3), der Welten-Gleichstand (Q4b,
inklusive Werkzertifikat — das PDF wird im Browser gebaut), der Lichttisch
`/studio/werke/rochade`, und die Anpassungen an `/studio/plan`, `/shop`,
`/product/*`, `/studio/auszahlung`, `/studio/werke/neu`.

---

## Offen für einen späteren Deploy (nicht Teil dieses Pakets)

Aus dem Welten-Gleichstand bleibt dreierlei liegen, weil es in Edge Functions
sitzt und ohne Not keinen Credit kosten soll:

- Kunst-/Möbel-Duktus und Preisorientierung in `studio-ai` / `pawn-chat`
- Neue Inszenierungen („Werk im Raum", „Möbel im Raum") in `generate-staging-shot`
- Kunst-/Interior-Vokabular in `classify-term` und den Kuratierungs-Prompts

Details stehen in `docs/welten-gleichstand-luecken.md`.
