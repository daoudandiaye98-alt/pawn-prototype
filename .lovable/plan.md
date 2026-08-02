## Wo Jarvis heute steht

Jarvis kann bisher genau einen Weg nach außen: **Designer suchen** (Instagram-Jagd → Profile → Kontakt → E-Mail). Alles andere — Kunden gewinnen, Presse, Sichtbarkeit bei Google, Weiterempfehlung — passiert gar nicht oder nur von Hand.

Der Gedanke: Akquise ist nur *ein* Organ. Jarvis soll ein **Wachstums-Organ** dazubekommen, mit mehreren Wegen, die alle dieselbe Mechanik nutzen, die schon funktioniert: suchen → prüfen → Entwurf → dein Ja/Nein → raus.

Wichtig vorweg: Jeder neue Weg läuft in derselben Sicherheits-Logik wie heute (Zone Gelb — Jarvis bereitet vor, du gibst frei). Nichts geht ohne dein Ja raus.

## Die fünf Wege (nach Wirkung pro Aufwand sortiert)

**1. Der Presse-Jäger (Zone Gelb)**
Jarvis sucht laufend nach Journalist:innen, Newsletter-Autor:innen, Kurator:innen und Blogs, die über unabhängiges Design, Slow Fashion, Keramik oder junge Kunst schreiben. Für jeden Treffer schreibt er einen kurzen, persönlichen Pitch — nicht über PAWN allgemein, sondern über *ein konkretes Haus*, das zu genau dem passt, was diese Person zuletzt veröffentlicht hat. Gleiche Prüf-Stapel-Mechanik wie bei den Designern: Ja/Nein, dann raus.
*Warum:* Ein einziger Artikel bringt mehr als 500 Instagram-Beiträge — und passt zur Marke, weil PAWN redaktionell auftritt.

**2. Die Kunden-Seite der Jagd (Zone Gelb)**
Dieselbe Jagd-Maschine, andere Beute: Sammler:innen, Interior-Fans, Menschen, die genau solchen Häusern folgen. Daraus wird kein Kaltkontakt, sondern eine **Nachbarschafts-Karte**: Jarvis erkennt, welche Communities, Orte und Themen unsere Käufer:innen teilen, und leitet daraus ab, wo PAWN sichtbar sein muss.
*Warum:* Wir wissen heute nicht, wer unsere Käufer sind. Ohne das ist jede Werbung geraten.

**3. Der Redakteur — PAWN publiziert selbst (Zone Gelb)**
Jarvis schreibt aus echten Daten wiederkehrende redaktionelle Stücke: Haus-Porträts, „Die Woche in Mode/Interior/Kunst" aus den Trend-Daten, Material-Geschichten. Das landet als Entwurf im Admin, du gibst frei → wird eine Seite auf pawn.vision (findbar bei Google, teilbar) und gleichzeitig Futter für die Posting-Queue.
*Warum:* Das ist der einzige Kanal, der auf Dauer *kostenlos* Besucher bringt und niemandem gehört außer uns.

**4. Der Verstärker — Häuser tragen PAWN (Zone Grün)**
Jarvis bemerkt, wenn ein Haus ein Video oder eine Première fertig hat, und legt dem Designer im Studio ein fertiges Paket hin: Clip, Caption, Hashtags, Link auf seine Hausseite. Ein Klick, geteilt. Dazu ein monatlicher Anstupser an Häuser, die lange nichts gezeigt haben.
*Warum:* Unsere Designer haben zusammen mehr Reichweite als PAWN je kaufen könnte — sie nutzen sie nur nicht.

**5. Der Späher — bezahlte Wege vorbereiten (Zone Gelb)**
Jarvis wertet aus, welche Häuser/Stücke organisch am besten laufen, und schlägt daraus fertige Anzeigen-Entwürfe vor (Bild, Text, Zielgruppe) — inklusive ehrlicher Warnung, wenn die Zahlen noch zu dünn für Werbebudget sind.
*Warum:* Geld erst ausgeben, wenn Daten sagen, wofür.

## Was ich zuerst bauen würde

Nicht alles auf einmal. Vorschlag Reihenfolge: **1 (Presse) → 4 (Verstärker) → 3 (Redakteur) → 2 (Kunden-Karte) → 5 (Späher)**. Presse und Verstärker nutzen fast nur Bausteine, die es schon gibt, und wirken sofort.

## Ein gemeinsames Fundament

Statt fünf Insellösungen bekommt Jarvis **einen** Wachstums-Rahmen, in den sich jeder Weg einhängt: gleiche Prüf-Logik, gleiches Aktionen-Log, gleiche Tageslimits, ein Admin-Bereich `/admin/wachstum` mit einem Stapel für alle Kanäle. So kostet jeder weitere Weg später wenig.

## Technische Details

- **Datenmodell:** `acquisition_leads` wird um `lead_type` erweitert (`designer` | `presse` | `kunde`), damit Jagd, Prüf-Stapel und Versand ohne Duplikate wiederverwendet werden. Neue Tabellen nur wo nötig: `growth_channels` (Kanal-Konfiguration + Tageslimits) und `editorial_drafts` (Weg 3).
- **Jarvis-Modi (`supabase/functions/pawn-jarvis/index.ts`):** `presse_jagd`, `presse_verfassen`, `redakteur`, `verstaerker`, `spaeher` — alle über die bestehende `runMode`-Verzweigung, LLM-Fallback-Kette und `jarvis_runs`/`jarvis_reports` unverändert.
- **Quellen:** Presse über Websuche + bestehende Apify-Profil-Anreicherung; Redakteur liest `fashion_ontology`, `video_assets.performance` und `designers.brand_dna` — keine neuen externen Dienste nötig.
- **Frontend:** `/admin/wachstum` mit kanal-gefiltertem Prüf-Stapel (Wiederverwendung von `PruefStapel.tsx` und `JagdPanel.tsx`), Studio-Karte für Weg 4 auf `/studio/videothek`.
- **Deploys:** Jede Ausbaustufe braucht genau *einen* Lovable-Deploy von `pawn-jarvis` — deshalb die Bündelung in Stufen statt vieler kleiner Züge.

## Deine Entscheidung

Sag mir, ob wir mit **Stufe 1 (Presse-Jäger + gemeinsames Fundament)** starten, oder ob du eine andere Reihenfolge willst.
