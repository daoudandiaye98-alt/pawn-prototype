# Akquise auf Output: 20–50 Einladungen pro Tag

## Was heute wirklich bremst (in der Datenbank nachgesehen)

- 278 Leads gesammelt — **nur 21 davon haben eine E-Mail-Adresse** (7,5 %). Ohne Adresse geht nichts raus.
- **8 Leads insgesamt kontaktiert.** 176 Leads liegen unbearbeitet auf "neu", 36 sind qualifiziert und warten.
- Das Tageslimit steht auf **10 E-Mails**, und pro Lauf werden nur 20 Leads geprüft und 10 Texte geschrieben — selbst mit genug Adressen wären 20–50 am Tag unmöglich.
- Die Automatik ist an, verlangt aber Score ≥ 70 **und** eine vorhandene E-Mail. Beides zusammen trifft aktuell fast nie zu.

Kurz: das Problem ist nicht die Menge der Funde, sondern **Kontakterkennung + zu enge Durchsatz-Deckel + zu viele Wartepositionen**.

## Der Umbau in fünf Schritten

### 1. Kontakterkennung vervielfachen (der größte Hebel)
Heute wird nur die Instagram-Bio und eine Handvoll Website-Pfade abgeklopft. Neu:
- Jeder Lead durchläuft eine **Kontakt-Kette**: Instagram-Business-Mail → Link-in-Bio (Linktree & Co. auflösen) → Website-Startseite → Impressum/Kontakt/About/Legal → Websuche nach "Marke + Kontakt/Impressum".
- E-Mails auch aus Bild-freien Schreibweisen erkennen ("name [at] domain punkt de").
- Existiert nur eine Domain ohne Adresse: **Kontaktformular-URL** merken und als eigener Weg führen.
- Ziel-Messgröße: Adressquote von 7,5 % auf über 50 %.

### 2. Jarvis entscheidet selbst
- Prüfen, Schreiben und Senden laufen in **einem durchgehenden Zyklus** — kein Lead bleibt zwischen zwei Stufen liegen.
- Die Freigabeschwelle sinkt auf Score ≥ 55; alles darüber mit Adresse geht ohne Rückfrage raus.
- Der Prüf-Stapel zeigt künftig nur noch **DM-Fälle und Presse** — also genau das, was du ohnehin selbst ansehen willst.
- Alte Karteileichen: die 176 "neu"-Leads werden in einem Nachhol-Lauf komplett durchgearbeitet.

### 3. Durchsatz-Deckel hochziehen
- Tageslimit 10 → **50**, verteilt über den Tag (Zyklus alle 2 Stunden statt alle 6, je bis zu 12 Sendungen).
- Pro Lauf: 60 Leads prüfen, 40 Texte schreiben, 40 Profile anreichern statt heute 20/10/20.
- Nachfass-Nachricht nach 5 Tagen bleibt und zählt in ein eigenes Kontingent, damit sie Erstkontakte nicht verdrängt.

### 4. Gezieltere Suche
- Mehr Suchläufe pro Tag (3 → 8) und mehr Treffer je Lauf, mit automatischer Gewichtung: Begriffe, die viele qualifizierte Leads **mit Adresse** liefern, bekommen mehr Läufe; schwache Begriffe fallen raus.
- Neue Quellen neben Hashtags: **Nachbarschaftssuche** (wem folgen bereits aufgenommene Häuser) und Ortsbegriffe je Welt.
- Doppelte und bereits kontaktierte Konten werden vor dem teuren Anreichern aussortiert.

### 5. Alle Wege statt nur E-Mail
Ein Lead wird über den **besten verfügbaren Kanal** angesprochen:
- **E-Mail** — vollautomatisch (Hauptweg, das Volumen).
- **Kontaktformular** — Jarvis legt den fertigen Text plus URL ab, im Cockpit ein Klick zum Absenden.
- **Instagram-DM** — fertiger Text mit Kopier-Knopf und Direktlink zum Profil, Abhaken erledigt.
- **Presse** — läuft weiter wie gehabt mit deiner Freigabe.

Dazu im Cockpit `/admin/akquise` eine ehrliche Tagesanzeige: gesendet heute nach Weg, Adressquote, Antwortquote, und was gerade klemmt.

## Sicherheitsnetze
- Harte Tagesobergrenze (einstellbar) und Not-Aus-Schalter bleiben.
- Eine Person wird nie doppelt angeschrieben; maximal zwei Berührungen insgesamt.
- Abmeldungen und "nein"-Entscheidungen sperren dauerhaft.
- Die Sprachgesetze (durchgehend positiv, keine Verneinungen) bleiben unverändert aktiv.

## Technische Details
- `supabase/functions/pawn-jarvis/index.ts`: `runAkquiseKontakt` zur Kontakt-Kette ausbauen (Linktree-Auflösung, Websuche-Fallback, obfuskierte Adressen, Formular-URL), `runAkquiseZyklus` als geschlossene Kette mit Nachhol-Logik, Batch-Limits in `runAkquiseKuratieren`/`runAkquiseVerfassen`/`runAkquiseProfile` anheben, Kanal-Auswahl im Sendeschritt.
- `acquisition_leads`: Spalten `contact_url`, `contact_channel`, `contact_attempts` ergänzen (Migration inkl. GRANTs, RLS admin-only wie bisher).
- `ai_config.akquise_config`: `email_daily_cap` 50, `autosend_min_score` 55, `hunt_daily_runs` 8, neue Batch-Werte — als Daten-Update, nicht hart im Code.
- Cron: `jarvis-akquise-zyklus` von `0 */6` auf `0 */2`, Jagd zweimal täglich.
- Frontend: `JagdPanel`/`AutomatikPanel`/`PruefStapel` um Kanal-Ansicht, Adressquote und DM/Formular-Aktionen erweitern.
- Die Edge Function `pawn-jarvis` braucht danach einen Deploy.
