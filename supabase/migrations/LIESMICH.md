# Migrationen

`supabase/migrations/` ist das **einzige** Migrationssystem dieses Repos.
Das frühere `drizzle/`-Verzeichnis wurde in Auftrag P aufgelöst: vier Dateien waren
Doppelungen vorhandener Migrationen, drei sind hierher umgezogen
(`20260930100000_rechte_zunageln.sql`, `20260930110000_anon_leserechte.sql`,
`20260930120000_rechte_ist_kauf_freigeschaltet.sql`).

In Auftrag R2 sind zwei weitere Schritte aus `drizzle/migrations` hierher
umgezogen: `20261002100000_zuglogik_berechnen.sql` und
`20261002110000_kunden_bilder_art_avatar.sql`. Der Ordner `drizzle/migrations`
existiert nicht mehr. Neue Schritte gehoeren ausschliesslich hierher.

## Nachgelegt in Auftrag R2

Die sieben Versionen `20261001100000` bis `20261001160000` waren auf
`rnakubexbqfgfciynqpt` angewendet und verbucht, ihre Dateien fehlten im Repo.
Sie sind jetzt angelegt (Inhalt unveraendert, nicht erneut ausgefuehrt). Der
Ordner bildet die Datenbank damit wieder vollstaendig ab.

## Namenskollision im Blick behalten

Der offene Zweig von PR #195 belegt `20260930090000` bis `20260930140000`.
Die drei aus drizzle umgezogenen Dateien liegen bei `20260930100000`,
`20260930110000` und `20260930120000` — wird #195 später übernommen, muss
**dort** umbenannt werden, nicht hier.
