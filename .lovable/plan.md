## Ausgangslage (geprüft im Code)

Die Akquise läuft heute schon halb-automatisch, aber **der erste Schritt fehlt**: In `supabase/functions/pawn-jarvis/index.ts` liest `runAkquiseImport` nur den **letzten bereits gelaufenen** Apify-Lauf (`/acts/<actor>/runs/last/dataset/items`). Niemand startet diesen Lauf — das machst du bisher von Hand im Apify-Dashboard. Danach funktionieren die Stufen `akquise_kuratieren` (Claude-Bildbewertung), `akquise_verfassen` (Erstnachricht) und `akquise_senden` bereits automatisch.

Ziel dieses Plans: Jarvis übernimmt auch das **Finden** — er entscheidet selbst, wonach gesucht wird, startet die Suche bei Apify, holt die Ergebnisse ab und lernt aus dem, was funktioniert hat.

## Was gebaut wird

### 1. Neuer Jarvis-Modus `akquise_jagd` (das Suchen)
Ein neuer Modus, der pro Lauf mehrere Suchaufträge an Apify schickt (`POST /v2/acts/<actor>/runs`) statt nur zu lesen:
- **Hashtag-Jagd**: Suchbegriffe je Welt (Mode / Interior / Kunst), z. B. Hashtags, Städte, Materialien.
- **Nachbarschafts-Jagd**: von bereits qualifizierten Leads und bestehenden PAWN-Häusern ausgehend ähnliche Konten scrapen (die stärkste Quelle, weil das Umfeld guter Häuser meist auch passt).
- Jeder Lauf wird in einer neuen Tabelle `acquisition_hunts` festgehalten (Suchbegriff, Welt, Apify-Run-ID, Status, Ausbeute).

### 2. Suchbegriffe kommen von Jarvis, nicht aus einer festen Liste
Vor dem Start destilliert Jarvis (Claude) aus `brand_dna` bestehender Häuser, `fashion_ontology` und den Score-Begründungen der letzten Leads eine Liste von 10–20 Suchaufträgen. Der Vorschlag landet in `ai_config.akquise_config.hunt_queries` und ist im Admin sichtbar/editierbar — du kannst also jederzeit eingreifen, musst aber nicht.

### 3. Import wird robust und dublettenfrei
`runAkquiseImport` wird umgebaut: Statt „letzter Lauf" holt er die Datasets **aller offenen Jagden**, sobald deren Apify-Run `SUCCEEDED` meldet. Zusätzlich:
- Abgleich gegen bestehende `designers` (Handle bereits Haus → überspringen) und gegen bereits aussortierte Leads (nicht erneut bewerten).
- Harte Vorfilter vor der teuren Bildbewertung: Follower-Spanne, Mindest-Postzahl, Shop-Erkennung, Ausschlusswörter (Reseller, Dropshipping, Agentur).
- Welt-Zuordnung pro Lead aus dem Suchauftrag statt pauschal `default_world`.

### 4. Lernschleife (macht die Jagd mit der Zeit besser)
Wöchentlich wertet Jarvis aus, welche Suchbegriffe zu hohen Kurator-Scores bzw. echten Anmeldungen geführt haben, und gewichtet die Begriffe neu (gute Begriffe öfter, schwache raus). Ergebnis als Bericht in `jarvis_reports`.

### 5. Zeitplan & Sicherheitsnetz
- `akquise_jagd` täglich per Cron (gleiches `JARVIS_CRON_SECRET`-Muster wie die bestehenden Modi), danach zeitversetzt `akquise_import` → `akquise_kuratieren` → `akquise_verfassen`.
- Zonen-System bleibt: Jagd/Import/Kuratieren = Grün (läuft allein), Senden bleibt Rot/Gelb (du bestätigst).
- Tages-Budget: maximale Anzahl Apify-Läufe und maximale Leads pro Tag in `akquise_config`, damit die Apify-Kosten gedeckelt sind.

### 6. Admin-Sichtbarkeit (`/admin/akquise`)
Ein neuer Abschnitt „Jagd": laufende und letzte Jagden mit Suchbegriff, Status, Ausbeute und Trefferquote, Knopf „Jetzt jagen", plus Bearbeiten der Suchbegriffe.

## Technische Details

- **Neue Tabelle** `acquisition_hunts` (id, query, query_type, world, apify_actor_id, apify_run_id, status, items_found, leads_created, qualified_count, created_at) inkl. GRANTs + RLS (nur Admin-Rolle über `has_role`).
- **Spalten** auf `acquisition_leads`: `hunt_id` (Herkunft der Jagd), `discovery_source` (hashtag / nachbarschaft / manuell).
- **Apify-Aufrufe** über den Connector-Gateway, falls die Apify-Verbindung gateway-basiert ist, sonst direkt mit `APIFY_TOKEN` (bereits hinterlegt). Actor-IDs pro Jagd-Typ konfigurierbar in `akquise_config` (`apify_actor_hashtag`, `apify_actor_profile`, `apify_actor_similar`).
- Alle Änderungen an der Edge Function `pawn-jarvis` → **Deploy nötig** (kostet Credits, ein einziger Deploy am Ende).
- Frontend-Teil (`AdminAkquise.tsx`) geht über Git und ist kostenlos.

## Offene Entscheidung

Nur Instagram jagen (wie bisher), oder zusätzlich TikTok und Behance/Etsy als zweite Quelle? Der Plan ist auf Instagram ausgelegt; weitere Quellen wären je ein zusätzlicher Actor plus Feld-Mapping. Sag Bescheid, wenn mehr rein soll — sonst starte ich Instagram-only.
