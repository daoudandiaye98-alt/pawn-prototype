## Was ich geprüft habe

- Absender ist bereits `PAWN <hallo@pawn.vision>` (in `ai_config.akquise_config`), Antwort-Adresse `pawnstudio.co@gmail.com`.
- In der Datenbank: **94 Leads, davon 0 mit E-Mail-Adresse und 0 mit Website.** 22 sind qualifiziert, 13 haben einen fertigen Nachrichtenentwurf, 2 gelten als „kontaktiert".
- Deshalb steht in Resend nichts: Der Versand überspringt jeden Lead ohne E-Mail (`if (!lead.email) skip`). Es wurde also nie eine Mail losgeschickt — nicht wegen Resend, sondern weil keine Adresse existiert.
- Ursache: Die Jagd läuft ausschließlich über Hashtag-Suchen. Die liefern Beiträge, keine Profildaten — also keine Bio, kein `externalUrl`, keine Geschäfts-E-Mail. Die vorhandene Website-Suche (Impressum/Kontakt) greift nur bei Leads *mit* Website und findet dadurch nie etwas.

## Der Plan

**1. Absender festziehen (pawn.vision)**
- Absender bleibt `PAWN <hallo@pawn.vision>`, weil pawn.vision die in Resend hinterlegte Domain ist. `hausofpawn.vision` wäre nur möglich, wenn diese Domain in Resend separat verifiziert wird — sonst lehnt Resend jede Mail ab.
- Antwort-Adresse wird ebenfalls auf `hallo@pawn.vision` gestellt (statt Gmail), damit Antworten im Marken-Postfach landen; Gmail kann als Weiterleitung dahinter hängen.

**2. Profil-Anreicherung in der Jagd (der eigentliche Fix)**
- Nach jeder Hashtag-Jagd läuft ein zweiter Apify-Durchgang mit dem Profil-Scraper über die gefundenen Konten. Der liefert Bio, Follower, Geschäfts-E-Mail und Website-Link.
- Diese Daten werden in den Lead geschrieben; hat ein Konto eine E-Mail, wechselt der Kanal automatisch von „DM" auf „E-Mail".

**3. Kontaktsuche verbessern**
- Läuft künftig auch für Leads im Status „neu", nicht nur „qualifiziert".
- Mehr Seiten (`/legal`, `/imprint`, `/contact-us`), Erkennung von `mailto:`-Links und verschleierten Schreibweisen („name (at) domain.com"), Auflösung von Linktree/Beacons-Seiten.
- Rollen-Adressen (`noreply@`, `support@`) werden abgewertet, persönliche/Studio-Adressen bevorzugt.

**4. Nachlauf für die vorhandenen 94 Leads**
- Einmaliger Anreicherungslauf über alle bestehenden Leads, damit der aktuelle Stapel nicht leer bleibt.

**5. Sichtbarkeit im Admin**
- Im Prüf-Stapel steht pro Lead klar: „E-Mail gefunden (Quelle: Bio/Website)" oder „nur DM möglich".
- Panel-Kopfzeile mit Zahlen: qualifiziert / davon mit E-Mail / heute versendet / Tageslimit.
- Knopf „Kontakt suchen" für einen manuellen Anreicherungslauf.
- Jeder Sendeversuch schreibt Erfolg **oder** Resend-Fehlertext ins Aktionen-Log, damit Fehlschläge nicht mehr stumm bleiben.

## Technische Details

- `supabase/functions/pawn-jarvis/index.ts`: neue Funktion `enrichProfilesViaApify()` (Actor `apify~instagram-profile-scraper`, Batch nach Handles), Aufruf am Ende von `runHunt` und als eigener Modus `akquise_kontakte`; `discoverContactViaWebsite()` um Status-Filter, Pfade, mailto-/Obfuskations-Regex und Linktree-Auflösung erweitert; `sendResendEmail` protokolliert Statuscode und Fehlerbody.
- Migration: `ai_config.akquise_config.email_reply_to` → `hallo@pawn.vision`.
- Frontend: `PruefStapel.tsx` und `JagdPanel.tsx` um Kontaktstatus, Kennzahlen und den Knopf erweitern.
- Nach der Änderung muss `pawn-jarvis` neu deployt werden (Lovable-Deploy, kostet Credits) — das ist der einzige nötige Deploy.

## Dein Teil in Resend

- Prüfen, dass `pawn.vision` unter „Domains" auf **verified** steht (DKIM/SPF grün). Nur dann geht überhaupt etwas raus.
- Wenn du `hausofpawn.vision` als Absender willst: Domain in Resend hinzufügen und die DNS-Einträge setzen — dann stelle ich den Absender um.
