## Was ich in der versendeten Mail gefunden habe

Der Text aus deinem Screenshot ist die **im Code fest verdrahtete Vorlage**, nicht deine. Fehlerpunkte:

1. **Verneinungen häufen sich:** „Kein Katalog, kein Marktplatz-Grau", „Für dich entstehen keine Kosten. Keine Grundgebühr, keine Mindestlaufzeit."
2. **Ausstieg als Schlusssatz:** „Wenn's nichts für dich ist — auch gut, mach weiter so." endet auf einer Absage statt einer Einladung.
3. **Defensiver Fußtext:** „Keine Lust auf weitere Nachrichten? Kurz antworten reicht, dann ist Ruhe."
4. **Preis vor Wert:** 93 % kommt vor der Idee; die Geschichte hinter der Arbeit fehlt fast völlig.
5. **Kein Name:** „Hey," statt „Hey Barbara," — obwohl der Name oft bekannt ist.

Dazu ein stiller Bug: Deine in der Datenbank hinterlegte Vorlage enthält **kein `<personal_line>`**. Jarvis recherchiert also den persönlichen Satz, setzt ihn aber nirgends ein — jede Mail geht identisch raus.

## Wie der Rest steht (geprüft)

- Leads: 169 „neu" unbearbeitet, 26 qualifiziert, davon 8 mit E-Mail. Nur 3 je kontaktiert.
- Versand steht auf **Zone Rot** und verlangt zusätzlich dein „Ja" — deshalb läuft nichts von selbst.
- **Presse-Jäger: 0 Kontakte** — der Kanal ist eingeschaltet, wurde aber nie ausgelöst (kein Zeitplan).
- Verstärker, Redakteur, Kunden-Karte, Späher: angelegt, aber ausgeschaltet und ohne Logik.

## Der Plan

**1. Neue Sprachgesetze für jede Nachricht**
Deine Fassung wird zur Grundlage (DE + EN), mit `<personal_line>` an der richtigen Stelle und `<name>` für die Anrede. Dazu bekommt Jarvis harte Leitsätze: positiv formulieren, jede Verneinung in eine Zusage drehen („kostenlos" statt „keine Kosten", „du behältst 93 %" statt „nur ein kleiner Anteil"), Wert vor Konditionen, Schluss als Einladung. Eine kurze Prüfung nach dem Schreiben verwirft Entwürfe mit Verneinungs-Mustern und schreibt sie einmal neu.

**2. Persönlicher Satz wieder scharf**
`<personal_line>` und `<name>` werden eingesetzt; fehlt der Name, greift eine warme Anrede ohne Lücke. Ein Entwurf ohne echten Rechercheinhalt geht nicht raus.

**3. Akquise läuft 24/7 von selbst — für E-Mail**
Der Versand an Leads **mit gefundener E-Mail** braucht künftig keine Freigabe mehr: qualifiziert + Entwurf fertig + Score über der Schwelle → raus, im Rahmen des Tageslimits (aktuell 10/Tag). Der DM-Weg bleibt bei dir im Prüf-Stapel, genau wie du es willst. Der Zeitplan zieht die ganze Kette mehrmals täglich durch: jagen → Profile laden → prüfen → schreiben → senden. Jede Mail landet weiter im Aktionen-Log; ein Not-Aus-Schalter im Admin hält alles sofort an.

**4. Der Stau wird aufgelöst**
Die 169 „neu"-Leads laufen automatisch durch Profil-Anreicherung und Bewertung, statt liegen zu bleiben.

**5. Presse zum Laufen bringen**
Presse-Jagd und Pitch-Schreiben kommen in den Zeitplan (Tageslimit 10). Presse bleibt bewusst bei deinem „Ja" — ein Journalist verzeiht eine schwache Mail schlechter als ein Studio. Die Pitches bekommen dieselben Sprachgesetze.

**6. Verstärker einschalten (der günstigste nächste Weg)**
Häuser mit fertigem Video bekommen im Studio ein fertiges Teil-Paket (Clip, Caption, Hashtags, Link). Läuft still, keine Freigabe nötig.

Redakteur, Kunden-Karte und Späher bleiben in diesem Zug aus — die kommen erst, wenn Presse und Verstärker Zahlen liefern.

## Technische Details

- `ai_config.akquise_config`: neue `template_de`/`template_en` mit `<name>`/`<personal_line>`, neues Feld `sprachgesetze`, `autosend_email: true`, `autosend_min_score`.
- `ai_config.jarvis_zones.akquise_senden` → `gelb`.
- `supabase/functions/pawn-jarvis/index.ts`: Prompt in `researchAndDraftLead` positiv umschreiben + Verneinungs-Prüfung, `runAkquiseVerfassen` setzt `<name>` ein, `runAkquiseSenden` löst die `admin_decision = 'ja'`-Pflicht für Kanal E-Mail (DM unverändert), neuer Modus `akquise_zyklus` als eine Kette für den Cron.
- Cron (pg_cron, bestehendes `JARVIS_CRON_SECRET`-Muster): `akquise_zyklus` alle 6 h, `presse_jagd` täglich, `presse_verfassen` täglich, `verstaerker` täglich.
- Frontend: `/admin/akquise` bekommt Not-Aus-Schalter und eine Zeile „Automatik läuft · X heute gesendet"; `/admin/wachstum` zeigt Laufzeiten je Kanal.
- **Ein Lovable-Deploy** von `pawn-jarvis` am Ende (Credits).

Sag Bescheid, ob ich so bauen soll — oder ob der Automatik-Versand zusätzlich eine Score-Schwelle (z. B. erst ab 75) bekommen soll.
