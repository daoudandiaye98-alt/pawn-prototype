# Migrationen

`supabase/migrations/` ist das **einzige** Migrationssystem dieses Repos.
Das frühere `drizzle/`-Verzeichnis wurde in Auftrag P aufgelöst: vier Dateien waren
Doppelungen vorhandener Migrationen, drei sind hierher umgezogen
(`20260930100000_rechte_zunageln.sql`, `20260930110000_anon_leserechte.sql`,
`20260930120000_rechte_ist_kauf_freigeschaltet.sql`).

## Auf der Datenbank verbucht, im Repo noch ohne Datei

Diese sieben Versionen stehen in `supabase_migrations.schema_migrations` der
Datenbank `rnakubexbqfgfciynqpt` und sind dort angewendet. Die zugehörigen
SQL-Dateien fehlen im Repo und werden von Daouda nachgelegt. Bis dahin bildet
der Ordner die Datenbank **nicht vollständig** ab.

| Version | erwarteter Dateiname |
|---|---|
| 20261001100000 | `20261001100000_begleiter.sql` |
| 20261001110000 | `20261001110000_schaufenster.sql` |
| 20261001120000 | `20261001120000_archetypen.sql` |
| 20261001130000 | `20261001130000_kunden_bilder_anproben.sql` |
| 20261001140000 | `20261001140000_begleiter_saetze_regeln.sql` |
| 20261001150000 | `20261001150000_deko_quelle.sql` |
| 20261001160000 | `20261001160000_designers_spalten_fuer_gaeste.sql` |

Leere Platzhalterdateien werden hier bewusst **nicht** angelegt.

## Namenskollision im Blick behalten

Der offene Zweig von PR #195 belegt `20260930090000` bis `20260930140000`.
Die drei aus drizzle umgezogenen Dateien liegen bei `20260930100000`,
`20260930110000` und `20260930120000` — wird #195 später übernommen, muss
**dort** umbenannt werden, nicht hier.
