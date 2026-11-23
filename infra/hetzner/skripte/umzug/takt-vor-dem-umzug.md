# Takt-Aufträge vor dem Umzug (altes Backend rnakubexbqfgfciynqpt)

Am 23.11.2026 um 20:08 Uhr auf Daoudas Wort **pausiert** (nicht gelöscht) — „Akquise nur
pausieren … wir überarbeiten einmal alles und aktivieren sie dann wieder“.

32 Aufträge gesamt. Diese 31 waren bis dahin aktiv und laufen erst wieder, wenn Daouda sie
nach der Überarbeitung freigibt (auf dem neuen Server, nie wieder im alten):

jarvis-heartbeat (*/20) · jarvis-morgenbericht (0 5) · jarvis-wissen (0 4) · jarvis-diagnose (30 3 Mo) ·
jarvis-akquise-import (10 *) · jarvis-akquise-verfassen (5,35 *) · jarvis-bewerbung-pruefen (30 3) ·
jarvis-akquise-senden (25 *) · jarvis-kampagnen-regie (30 4 So) · compute-trends-daily (15 3) ·
jarvis-bauplan (30 4 Mo) · jarvis-broll-einsammeln (*/15) · jarvis-zeitgeist (0 5 So) ·
jarvis-akquise-jagd (0 8,22) · jarvis-akquise-import-abend (30 23) · jarvis-akquise-kuratieren (*/10) ·
jarvis-akquise-jagd-lernen (30 5 Mo) · jarvis-akquise-kontakt (*/30) · jarvis-presse-jagd (0 6) ·
jarvis-presse-verfassen (30 7) · jarvis-verstaerker (0 8) · jarvis-wissen-markenaufbau (15 4 Mo) ·
jarvis-akquise-dm-vorbereiten (45 5) · jarvis-signalstrom-verdichten (30 3) · jarvis-tueren-finden (15 4 Di) ·
jarvis-maison-sichtbarkeitszug (15 6 Mo) · jarvis-akquise-wirkungsbericht (0 5 Mo) ·
jarvis-akquise-bilder-spiegeln (*/15) · jarvis-akquise-wache (*/30 9–19) ·
jarvis-akquise-entwuerfe-kuerzen (0 6) · rochade-aufraeumen (*/10)

Schon vorher aus: jarvis-akquise-zyklus (0 */2).

Hinweis: Im alten System darf nur der Besitzer (postgres) seine Aufträge ändern —
`update cron.job` wird verweigert, `cron.alter_job(job_id := …, active := false)` geht.
