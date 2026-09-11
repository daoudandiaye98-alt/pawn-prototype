# L1 — der erste Bruch: die Migrationskette ist nicht abspielbar

Stand 11.09.2026 · Zweig `claude/teil-l-konto` · Projekt `cnxtdcifkrdxvajaikxq`

Der Auftrag Teil L sagt: **„in Stapeln, beim ersten Bruch anhalten und ihn
benennen, statt zu reparieren."** Genau das ist hier passiert. Dieser Text ist
die Benennung. Es wurde nichts repariert und nichts erfunden.

## Was gemessen wurde

35 von 161 Migrationen liegen auf der neuen Datenbank. Der 14. Stapel ist
abgebrochen:

```
ERROR:  42P01: relation "public.acquisition_leads" does not exist
```

Der Stapel lief in einer Transaktion — **nichts davon** ist in der Datenbank
gelandet. `list_migrations` zeigt unverändert 35 Zeilen, alle mit der Version
aus dem Dateinamen, keine fremde.

## Warum es bricht

`supabase/migrations/` ist **in Dateinamen-Reihenfolge nicht abspielbar**. Vier
Tabellen werden geändert, bevor sie angelegt werden. Mechanisch geprüft von
`scripts/verify/migrationen-kette.mjs`:

| Tabelle | erste Änderung in | wird angelegt in |
|---|---|---|
| `acquisition_leads` | `20260721230200_jarvis_akquise_autopilot.sql` | **von keiner Datei** |
| `designer_automations` | `20260810093133_4541eddb-…sql` | `20260820090000_automatik_matrix_teil28c.sql` — 10 Tage zu spät |
| `designer_opportunities` | `20260810093133_4541eddb-…sql` | `20260822090000_designer_opportunities_teil34a.sql` — 12 Tage zu spät |
| `designer_billing_profiles` | `20260811000239_87ee7771-…sql` | `20260814090000_versand_werkzeug.sql` — 3 Tage zu spät |

`acquisition_leads` ist der schwere Fall: **24 Dateien ändern sie, keine einzige
erschafft sie.** Sie hat auf der alten Datenbank existiert (die alte
`src/integrations/supabase/types.ts` kennt sie mit 58 Spalten), aber sie hat nie
eine Datei gehabt. Nach Gesetz 1 existiert nicht, was keine Datei ist — und
deshalb kann der Erstaufbau sie nicht bauen.

Das ist derselbe Befund wie bei `20260929090000_zugaenge_daouda`, nur ohne
Rettung: dort lag der Text noch in der Historie der alten Datenbank und konnte
wörtlich zurückgeholt werden. Diese Datenbank ist gelöscht. Für
`acquisition_leads` gibt es keinen wörtlichen Text mehr.

## Die neue Prüfung

`scripts/verify/migrationen-kette.mjs` liest nur die Dateien — kein Netz, keine
Datenbank. Je Änderung fragt sie: gab es vorher, in Dateinamen-Reihenfolge, ein
`create table` dafür?

Beide Richtungen vorgeführt:

```
$ node scripts/verify/migrationen-kette.mjs
KETTE: 0/1 · FEHLER: acquisition_leads, designer_opportunities,
                     designer_automations, designer_billing_profiles
Ausgang 1

$ node scripts/verify/migrationen-kette.mjs <Kopie, in der genau diese vier angelegt werden>
  162 Dateien, Kette geschlossen.
KETTE: 1/1 · FEHLER: keine
Ausgang 0
```

Die erste Fassung dieser Prüfung war falsch: sie las `storage.objects` als
Tabelle `storage` und meldete 13 Fehlalarme an rechtmäßigem Code. Sie ist jetzt
schema-bewusst und prüft nur `public`. **Sie ist absichtlich noch nicht in
`verify.sh schnell` verdrahtet** — sie ist heute echt rot, und eine dauerhaft
rote Prüfung im Tor blockiert jeden Commit und lehrt, Rot zu übersehen. Sie wird
verdrahtet, sobald die Lücke geschlossen ist.

## Was das blockiert

- **L1** Abnahme (`migration list` == Dateinamen) — steht bei 35 von 161.
- **L2** RLS-Prüfung mit anon-Schlüssel — braucht die Tabellen.
- **L3** `sichten: true` — braucht neue `types.ts`, die braucht das Schema.
- **L4** Saatgut DRAPÉ — braucht `designers`/`products`-Endstand.
- **L18** Prüfung der Zugangs-Migration — sie ist Datei 161.

**Nicht blockiert** und geht weiter: L5–L11 (das Konto zieht ins Heft),
L12 (Wächter), L13 (Anklopfen statt Frist), L15 (Freistellen), L16 (`heft.d.ts`).

## Was Daouda entscheiden muss

Für die drei Reihenfolge-Fälle (`designer_automations`,
`designer_opportunities`, `designer_billing_profiles`) gibt es nichts zu
erfinden — die Tabellen stehen in Dateien, nur an der falschen Stelle. Sie
laufen, wenn der Erstaufbau die drei anlegenden Dateien vorzieht.

Für `acquisition_leads` gibt es drei Wege. Keiner davon ist von mir gegangen
worden:

1. **Eine neue Migration schreiben, die sie anlegt.** Die Form ist ableitbar,
   nicht geraten: Endstand aus der alten `types.ts` (58 Spalten) minus die
   Spalten, die die 24 späteren Dateien selbst hinzufügen — der Rest ist die
   Grundform. Das Ergebnis wäre nachprüfbar: nach allen 24 Dateien muss die
   Tabelle wieder exakt die 58 Spalten haben. Das ist der saubere Weg und er
   braucht deine Freigabe, weil er Schema erfindet, das nie eine Datei hatte.
2. **Die Akquise beim Erstaufbau weglassen.** Die 24 Dateien überspringen. Dann
   fehlt die ganze Akquise-Maschine (Leads, Kurator-Auge, Sendemappe) auf der
   neuen Datenbank, und `migration list` stimmt nicht mit dem Ordner überein.
3. **Den Erstaufbau abbrechen und die alte Datenbank wiederherstellen.** Geht
   nicht — das Projekt `rnakubexbqfgfciynqpt` ist gelöscht, der Name löst nicht
   mehr auf.

Meine Empfehlung ist Weg 1, weil er als einziger die Abnahme aus L1 erreichbar
lässt und weil die Ableitung überprüfbar ist statt geraten. Aber es ist deine
Entscheidung, nicht meine.

## Zwei Nebenfunde aus den gespielten Stapeln

1. **Ein Nachtjob zeigt auf die tote Datenbank.** Die pg_cron-Migration aus
   Stapel 8 legt `compute-trends-daily` an und ruft darin fest verdrahtet
   `https://rnakubexbqfgfciynqpt.supabase.co/functions/v1/compute-trends`. Das
   Projekt gibt es nicht mehr. Der Job wird ab sofort jede Nacht um 3:15 Uhr ins
   Leere posten. Nicht repariert (Regel 3), gehört in eine eigene, spätere
   Migration.
2. **Ein geteiltes Geheimnis steht im Klartext im Repo.**
   `20260721221200_jarvis_wissen_postfach_dna.sql` schreibt
   `ai_config.jarvis_cron_secret` mit einem festen 64-Zeichen-Wert. Wer das
   Repo lesen kann, kann Jarvis-Läufe ohne Admin-Login auslösen. Es steht
   in der Git-Geschichte und lässt sich nicht mehr herauslöschen — der Wert
   müsste getauscht werden. Auch das nicht repariert.
