## Warum heute nichts passiert (geprüft in Datenbank und Code)

- `acquisition_hunts` ist **leer**, und `akquise_jagd` taucht in **keinem** `jarvis_runs`-Eintrag auf — für diesen Modus wurde nie ein Zeitplan angelegt. Die Jagd ist gebaut, aber nie gestartet.
- `akquise_import` scheitert seit dem 27.07. **täglich** mit „Apify 404: konnte letzten Lauf nicht lesen." — weil es keine offenen Jagden gibt, fällt der Code auf den alten Pfad „letzter Lauf des Actors" zurück, und dort existiert kein Lauf.
- `akquise_kuratieren` ist **nie gelaufen**. Alle 24 Leads haben `kurator_score = NULL` und stehen trotzdem auf „qualifiziert" (aus dem alten Handimport). Es hat also nie eine Qualitätskontrolle stattgefunden.
- **Kein einziger Lead hat eine E-Mail-Adresse** → Kanal fällt auf „dm", und für DMs gibt es keinen Weg nach draußen. Deshalb wurde bis heute niemand eingeladen.
- Claude antwortet seit Tagen mit „credit balance too low" — davon sind Morgenbericht, Wissen, Kuratieren und Verfassen betroffen.
- Ein `akquise_verfassen`-Lauf hängt seit 01.08. 02:15 auf `running`; der Herzschlag meldet seither 660-mal „laeuft_bereits" und tut nichts.
- `hunt_queries` in `akquise_config` ist leer — Suchbegriffe müssten also erst destilliert werden.

## Was gebaut wird

### 1. Selbstheilung und Zuverlässigkeit (Fundament)
- **Modell-Kette statt einzelnem Anbieter:** Jeder Jarvis-Aufruf versucht Anthropic, und bei Guthaben-, Rate-Limit- oder Serverfehler automatisch das eingebaute Lovable-Gateway (`openai/gpt-5.6-sol`), danach OpenAI. Der genutzte Anbieter wird je Lauf protokolliert. Kein Lauf stirbt mehr an einer leeren Geldbörse.
- **Hängende Läufe:** Läufe, die länger als 15 Minuten auf `running` stehen, werden automatisch auf `failed` gesetzt, bevor ein neuer Lauf startet. Der aktuell hängende Lauf wird einmalig bereinigt.
- **Sparsamkeit:** Bildbewertung nur mit maximal 4 Bildern statt allem, harte Vorfilter **vor** jedem Modellaufruf, günstiges Modell für Klassifizierung, teures nur für Textentwürfe. Kosten je Lauf werden in `jarvis_runs` mitgeschrieben, damit sichtbar ist, was die Akquise kostet.

### 2. Die Jagd tatsächlich starten (mehrere Quellen)
- Zeitplan für `akquise_jagd` anlegen (täglich, gestaffelt vor dem Import) — das ist der fehlende erste Dominostein.
- Quellen, jeweils eigener Apify-Actor, konfigurierbar in `akquise_config`:
  - **Instagram Hashtag** (bestehend)
  - **Instagram Nachbarschaft** — ähnliche Konten zu bereits guten Leads und bestehenden PAWN-Häusern
  - **TikTok** (Hashtag/Suchbegriff)
  - **Behance** (Kategorie/Feld)
- Suchbegriffe destilliert Jarvis aus der Brand-DNA der bestehenden Häuser, wenn die Liste leer ist; du kannst sie im Admin jederzeit überschreiben.
- Tagesdeckel für Apify-Läufe und Leads bleibt bestehen, wird pro Quelle getrennt geführt.

### 3. Qualitätskontrolle, die wirklich greift
- **Stufe A (kostenlos):** Follower-Spanne, Mindest-Postzahl, Ausschlusswörter, Dubletten gegen `designers` und bereits aussortierte Leads, Sprach-/Länder-Plausibilität.
- **Stufe B (Modell, günstig):** Bildbewertung mit Score 0–100 und Begründung je Kriterium (Handwerk, Bildsprache, Fotoqualität, Unabhängigkeit, Welt-Passung) — genau wie heute im Code, nur mit funktionierendem Modell und Bildbegrenzung.
- **Stufe C (Mensch):** Alles ab Schwelle landet als Karte im Admin. Du kannst mit einem Klick „Ja" oder „Nein" sagen; jede Entscheidung wird gespeichert.
- Ein einmaliger Nachlauf bewertet die 24 Alt-Leads nach, damit kein ungeprüfter Kontakt angeschrieben wird.
- Zeitplan für `akquise_kuratieren` anlegen (fehlt bisher komplett).

### 4. Einladung: E-Mail automatisch, DM als Karte
- **Kontaktsuche:** Neuer Schritt sucht zu jedem qualifizierten Lead eine E-Mail — Business-Mail aus dem Profil-Scrape, Link-in-Bio-Seite, Impressum/Kontakt der Website, Etsy-/Shopseite. Gefundene Adresse → Kanal „email".
- **E-Mail-Weg:** Bestehender Resend-Versand mit deiner festen Vorlage (deutsch/englisch, personalisierter erster Satz), Tagesdeckel, ein Follow-up nach 5 Tagen, danach Ruhe. Freigabe-Zone bleibt wie eingestellt (rot = du bestätigst die Tagesliste, grün = läuft allein).
- **DM-Weg:** Leads ohne Mail erscheinen im Admin als Karte mit fertigem Text, Kopier-Knopf und Link zum Profil. Ein Klick auf „gesendet" setzt Status und Follow-up-Termin. Kein automatisiertes DM-Versenden — das kostet Instagram-Accounts.
- Opt-out, Höchstzahl Berührungen und Antwort-Erkennung bleiben wie gebaut.

### 5. Lernschleife
Wöchentlich wertet Jarvis aus, welche Suchbegriffe und welche Quelle zu hohen Kurator-Scores, zu Antworten und zu echten Anmeldungen geführt haben, gewichtet gute Begriffe hoch, wirft schwache raus und schreibt einen Bericht. Zusätzlich: die Merkmale angenommener gegenüber abgelehnter Leads fließen als kurze Regelliste in den Kurator-Prompt zurück — die Filterung wird also mit deinen Entscheidungen schärfer.

### 6. Admin-Sicht `/admin/akquise`
- Jagd-Panel bekommt: Quelle je Zeile, Trefferquote, Kosten, und eine Ampel „Kette gesund / hängt seit …".
- Neue Abschnitte: **Prüfen** (Kuratoren-Karten mit Bildern, Score, Begründung, Ja/Nein) und **DM-Liste** (Text kopieren, gesendet markieren).
- Pipeline-Zeile oben: gefunden → geprüft → qualifiziert → angeschrieben → geantwortet → registriert.

## Technische Details
- Änderungen fast ausschließlich in `supabase/functions/pawn-jarvis/index.ts` (Modell-Fallback, Lauf-Bereinigung, neue Quellen, Kontaktsuche, Lernschleife) → **ein einziger Deploy am Ende**, Kosten gebündelt.
- Datenbank: Spalten `contact_source`, `provider_used`, `cost_cents` sowie ein Entscheidungsfeld für deine Ja/Nein-Klicks; `acquisition_hunts` bekommt `source`. Bereinigung des hängenden Laufs.
- Zeitpläne: `akquise_jagd` (täglich 22:00), `akquise_kuratieren` (23:45), `akquise_import` (23:30 und 01:00, bereits vorhanden), `akquise_verfassen` (02:15, vorhanden), Lernlauf montags.
- Frontend (`JagdPanel.tsx`, `AdminAkquise.tsx`) läuft über Git und kostet keine Credits.

## Was du selbst tun musst
1. Anthropic-Guthaben aufladen (der Fallback fängt es sonst zwar ab, aber Claude ist für die Bildbewertung der beste).
2. Absender-Domain in Resend verifizieren, falls `hallo@pawn.vision` noch nicht verifiziert ist — sonst gehen die Einladungen nicht raus.
3. Apify-Actors für TikTok und Behance einmal freigeben (kostenpflichtig je Lauf); ich trage die Actor-IDs voreingestellt ein, du kannst sie im Admin ändern.
