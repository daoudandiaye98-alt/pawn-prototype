# Die Kennzahl

Nachfunde durch einen **Menschen** nach dem Merge. Das ist die einzige Zahl, die
zählt.

Sinkt sie über vier Wochen nicht, misst das System das Falsche — dann liegt die
Arbeit in `.claude/regressionen.json`, nicht in mehr Werkzeugen.

Jeder Nachfund löst das Ritual aus (`.claude/rules/00-gesetze.md`): Zeile in
`regressionen.json` **und** Kontrolle in `scripts/verify/`, einmal rot
vorgeführt. Ohne beides gilt der Fehler als nicht erledigt.

| Datum | PR | Nachfunde | Was | Zusage/Kontrolle daraus |
|---|---|---|---|---|
| 2026-08-17 | — | — | Turm v2 gebaut. Grundlinie: 6 Zusagen, jede rot vorgeführt. Ab hier wird gezählt. | Z1–Z6 |

## Grundlinie, gegen die gemessen wird

Vor diesem Umbau gab es keine Zahl. Was es gab, war die Commit-Geschichte: in den
letzten 200 Commits stehen **27 Commits, die mit „Fix:" beginnen** — jeder davon
ein Mangel, der nach dem Bauen gefunden wurde. Einige reparieren dieselbe Sache
zweimal (`17eacd5` und `6ecb3ee`, beide Prüfstand-Absturz).

Das ist die Grundlinie. Sinkt der Anteil der Fix-Commits in den nächsten vier
Wochen nicht, hat der Harness nichts gebracht.

## Offene Entscheidung fürs erste Ausmisten (fällig 2026-09-14)

**`pawn-kontext` hat die Latte nicht genommen.** Gemessene Evaluation gegen die
Fassung ohne Skill:

| Skill | mit | ohne | Differenz | Urteil |
|---|---|---|---|---|
| `kreuzverhoer` | 6.0/6 | 2.0/6 | **+4.0** | DEUTLICH |
| `deploy-choreografie` | 6.0/6 | 2.5/6 | **+3.5** | DEUTLICH |
| `zera-audit` | 6.0/6 | 1.5/6 | **+4.5** | DEUTLICH |
| `pawn-kontext` | 5.0/6 | 4.5/6 | **+0.5** | SCHWACH |

Die Auslöser sitzen dagegen bei allen vieren — 8 von 8 richtig, je ein Satz, der
auslösen muss, und einer, der es nicht darf:

| Satz | erwartet | gemessen |
|---|---|---|
| „Warum kann das Atelier-Haus kein Video erzeugen?" | `pawn-kontext` | ✓ |
| „Wie spät ist es in Tokio?" | KEINER | ✓ |
| „Neuer Eimer, Migration + Frontend + Function, ein PR. Bau das." | `kreuzverhoer` | ✓ |
| „Schreib eine freundliche Absage-Mail." | KEINER | ✓ |
| „create-checkout geändert, Migration dabei. Kann das raus?" | `deploy-choreografie` | ✓ |
| „Benenne `spanne` in `preisSpanne` um." | KEINER | ✓ |
| „Weißer Text auf Foto, Knopf 36 px. Ist das fertig?" | `zera-audit` | ✓ |
| „Was bedeutet ECONNREFUSED allgemein?" | KEINER | ✓ |

Der Auftrag verlangt: *mit Skill schlägt ohne Skill **deutlich***. Mit +0,5 tut
`pawn-kontext` das nicht. Er fällt aber auch nicht unter „kein Unterschied", was
sofortiges Löschen bedeutet hätte.

**Warum die Messung schwach ist:** Der Lauf ohne Skill durfte das Repo lesen und
hat sich das Wissen erarbeitet — er fand sogar Dinge, die der Skill nicht nennt
(`DEFAULT_PLAN_QUOTAS.atelier.videos = 15` fest im Code, das `ON CONFLICT DO
NOTHING` in der Kassenmigration). Gemessen wurde also **Richtigkeit**, nicht
**Kosten der Wiederentdeckung**. Und selbst dort war der Skill nicht billiger:
58.813 Tokens mit gegen 57.219 ohne.

**Zu entscheiden am 2026-09-14:** Hat `pawn-kontext` in vier Wochen nachweislich
etwas gefangen? Wenn nein, fliegt er raus — sein Inhalt liegt gesichert in
`.claude/archiv/CLAUDE.md.vor-turm-v2`, und die nicht ableitbaren Teile stehen
ohnehin in `CLAUDE.md` und `.claude/rules/edge-functions.md`.
