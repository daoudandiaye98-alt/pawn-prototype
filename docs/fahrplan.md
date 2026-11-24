# PAWN · Fahrplan zum Launch

Stand 24.11.2026. Spiegel des Docs [PAWN · Fahrplan zum Launch](https://claude.ai/artifact/HMgPF6gXzpxAdGF1Q7LRfv). Ändert Daouda das Doc, wird diese Datei nachgezogen. Die Reihenfolge bestimmt Daouda.

## Auf einen Blick

PAWN wird in sechs Schritten vom Prototyp zum laufenden Marktplatz: erst ein eigenes Zuhause, dann der Feinschliff, dann echte Werke im Shop.

1. **Umzug** — PAWN läuft komplett auf unserem eigenen Server bei Hetzner, mit eigener Datenbank.
2. **Design mit Fable** — die Mechaniken bleiben, alles wird flüssiger und hochwertiger.
3. **Funktionen fertig** — Kampagnen, Produktfotos aus dem Handyfoto, Anprobe; so viel wie möglich auf eigener Technik.
4. **Der Shop als Spiel** — eine Stil-Matrix für Mode, Kunst und Interior, dazu das Schaufenster in den Doppelseiten.
5. **Die Helfer** — Mini-PAWN, PAWN Jarvis über Angel, das Designerstudio mit Upload und Stripe-Checkout.
6. **Akquise und Start** — Profile finden, persönlich einladen, den Shop mit echten Werken füllen.

Zum Start gibt es keine bezahlten Pläne: Jedes Haus bekommt die Basis — Werke hochladen, freistellen, Produktfotos.

## Schritt 1 — Umzug ins eigene Zuhause

Das Paket ist fertig (`infra/hetzner`, LIESMICH dort). Es wartet auf die Server-Bestellung; der freigegebene CX33 ist bei Hetzner am 24.11. in allen EU-Standorten ausverkauft.

- **Erledigt:** offizielles Supabase-Self-Hosting mit Caddy, Steuerpult ohne Terminal, Tresor für Schlüssel, nächtliche Sicherung. Probelauf: 42/42 Tabellen zeilengleich, Rechte identisch, 50/50 Funktionen starten.
- **Erledigt am 24.11.:** eigenes Hetzner-Projekt „PAWN" (ID 16908063) mit eigenem Token (reicht nicht an Angels Server). Alle 32 Takt-Aufträge im alten System pausiert.
- **Offen, Daoudas Wahl:** A) CPX32 (4 Kerne, 8 GB, Helsinki) 36,49 € netto/Monat inkl. Backup und IPv4, später Wechsel auf CX43 (19,69 €) · B) CPX22 (2 Kerne, 4 GB) 20,29 €, später CX33 (10,69 €) · C) auf CX33 warten.
- **Danach, in dieser Reihenfolge:** Server anlegen → api, studio, neu.pawn.vision → Daten umziehen → alte Schlüssel über die Brücke → Dateien (auch die 62 privaten) → Abgleich alt gegen neu → Google-Anmeldung und Stripe-Webhooks umstellen → pawn.vision umschalten.

**Fertig, wenn** pawn.vision von unserem Server kommt, Anmeldung, Kasse und Bilder dort laufen und das alte Backend nichts mehr tut.

## Schritt 2 — Design mit Fable

Die Mechanik bleibt, der Schliff kommt dazu. Neu erfunden wird nichts.

**Die Choreografie, die bleibt** (gesehen am 24.11. auf pawn.vision):

1. Ladefeld „Eine Welt entfaltet sich".
2. Das Heft erscheint als Cover in 3D und dreht sich in den Raum.
3. Es blättert auf und legt sich flach.
4. Aus der Doppelseite klappt die Bühne auf, die Werke stehen als Aufsteller.
5. Das Heft steht als Menü.

**Was heute sichtbar hakt** (Fensterbreite 800 px): Beim Wechsel der Schlagzeile stehen „Independent minds" und „Your move" kurz übereinander · die Schlagzeile überdeckt das offene Heft · die kleinen Beschriftungen unten sind kaum lesbar.

**Award-winning konkret:** Awwwards wertet Design 40 %, Bedienbarkeit 30 %, Kreativität 20 %, Inhalt 10 % (https://awwwards.com/about-evaluation).

**Fertig, wenn:**

- jede Bewegung auf einem Mittelklasse-Handy ohne Ruckeln läuft (nur `transform` und `opacity` animiert);
- der erste Inhalt in unter 2,5 s steht, ein Klick in unter 200 ms antwortet und nichts springt;
- pro Moment nur eine Bewegung läuft und Texte nie übereinander wechseln;
- „Direkt entdecken" die Choreografie überspringt und reduzierte Bewegung respektiert wird;
- 390 px und iPad sauber sind und die Design-Gesetze aus `CLAUDE.md` halten.

**Übergabe an Fable:** Heft in `src/heft03`, Three.js nur in `dreiD.mjs`. Augen: `tools/heft-sicht.mjs`, Prüfstand, Skill `zera-audit` als Abnahme.

## Schritt 3 — Funktionen fertig

Die Strecke: Handyfoto rein, freistellen, Produktfoto aus mehreren Ansichten, Anprobe, Kampagne.

| Baustein | Wo im Studio | Heute über |
| --- | --- | --- |
| Freistellen | Heft-Seite (`freistellen`) | fal: BiRefNet, rembg |
| Produktfoto, Inszenierung | Werke, Mediathek, neue Kampagne, neues Stück | fal: „nano-banana" (Google) |
| Anprobe | Heft und Kampagne (`anprobe`, `generate-tryon`) | fal: „nano-banana-pro", Kling Kolors als Ersatz; IDM-VTON seit 24.11. raus |
| Kampagnen-Video | neue Kampagne, Editionen | fal: Wan 2.2, Kling 2.1 |
| Texte, Jarvis, DNA | Studio, Heft, Admin | Anthropic, OpenAI, Lovable-Gateway |

**Mira, richtig:** Gemeint ist die Chrome-Erweiterung von [trymira.style](https://www.trymira.style), „Mira: Virtual Try-on", Version 0.2.14. Sie ist nicht quelloffen; nachgebaut ist das Muster, nicht der Code. Vergleich mit Google, FASHN und den Namensvettern im Doc, Tab „Anprobe: Mira & Co.".

- **Gebaut am 24.11., die Drehbühne:** Ein Outfit aus bis zu drei Stücken wird in einem Bild angezogen. Danach rechnet PAWN Seite und Rücken im Hintergrund, und das Ergebnis dreht sich auf einer 3D-Bühne: per Antippen, Pfeiltaste oder Wischen, bei reduzierter Bewegung als Überblendung.
- An jedem Ergebnis steht „Mit KI erzeugt". Die Anprobe läuft nur mit Einwilligung, Seite und Rücken höchstens drei Mal je Anprobe.
- **Kosten:** 0,15 $ je Bild, rund 0,45 $ für eine Anprobe mit Seite und Rücken. Das zahlt PAWN.
- **Live seit 24.11.:** #205 gemergt, `anprobe` und `generate-tryon` über Lovable ausgeliefert. Die neue Optik (dein Bild im Rahmen, „PAWN legt an", Vorhang, Vorher/Nachher) wartet als #206 auf den Merge.
- **Augen:** `node tools/anprobe-probe.mjs [ruhig|bewegt|mobil] [sechs] [alt|fehlschlag]`.

**Eigene Technik (kommerziell nutzbar):** Freistellen BiRefNet (MIT) · Produktfoto und Ansichten Qwen-Image-Edit-2511 (Apache 2.0) · Anprobe FASHN VTON v1.5 (Apache 2.0) · Video Wan 2.2 TI2V-5B (Apache 2.0, ab 24 GB).

**Fertig, wenn:**

- aus einem Handyfoto in unter einer Minute ein freigestelltes Werk mit drei Ansichten wird;
- die Anprobe nur mit Einwilligung läuft und kein Foto gespeichert bleibt;
- aus einem Werk ein Reel in der Signatur des Hauses entsteht, veröffentlicht erst nach Freigabe;
- jede KI-Funktion in `ai_config` zwischen „eigen" und „Dienst" umschaltbar ist (die KI-Weiche).

## Schritt 4 — Der Shop als Spiel

Jedes Haus baut seine Doppelseite aus Bausteinen. Dieselbe Stil-Matrix beschreibt Werke, Häuser und den Geschmack der Besucher.

**Schon da:** Schaufenster mit drei Kulissen (`app.js`: Bogen & Vorhang, offene Galerie, gefaltete Kulisse) und Werkauswahl; 18 Archetypen (6 je Welt); Stilberatung; `fashion_ontology`; Signaturen.

**Achsen:** Welt (PAWN) · Richtung (Getty AAT „Styles and Periods", ODC-By 1.0) · Gegenstand (Fashionpedia: 27 Kategorien, 19 Teile, 294 Merkmale, CC BY 4.0; AAT „Objects") · Material und Technik (AAT) · Form (Fashionpedia, AAT „Design Elements") · Stimmung (eigene Liste).

**Schaufenster als Baukasten:** Kulisse, Licht, Anordnung, Bewegung, Hausnotiz. Vorschlag: neue Bausteine schaltet der Rang frei — nie ein Plan, nie Geld.

**Fertig, wenn:** die Matrix mit Quellen für alle drei Welten steht und jedes neue Werk einen Einordnungs-Vorschlag bekommt · ein Haus sein Schaufenster ohne Hilfe in unter fünf Minuten baut (Vorschau 390 px) · die Stilberatung auf dieselben Achsen schreibt und jede Empfehlung einen Grund nennt.

## Schritt 5 — Die Helfer und das Studio

| Helfer | Für wen | Heute | Ziel |
| --- | --- | --- | --- |
| Mini-PAWN | Besucher | Begleiter im Heft und Studio | grafisch fertig mit Fable, kennt Katalog und Stil-Matrix |
| PAWN-KI je Haus | Designer | `studio-ai` | Kundenanfragen, Versand, Abläufe |
| PAWN Jarvis | Daouda | `pawn-jarvis` | denkt in Angel (Hetzner „angel-kern"), handelt nur über die bestehende Whitelist |

Studio: Anmeldung, Stripe verbinden, Werk hochladen, freistellen, Bestellung, Versand, Auszahlung (93 % an das Haus, 7 % Provision, `ai_config.platform_commission`). Die Plan-Seite `/studio/plan` (Atelier, Maison) ist im Code noch aktiv und wird zum Start ausgeblendet.

**Fertig, wenn:** ein neues Haus in unter 15 Minuten ohne Hilfe auf der Bühne steht · ein Testkauf 93 zu 7 aufteilt und Bestellung und Versandmail auslöst · Jarvis seinen Morgenbericht über Angel schreibt und außerhalb der Whitelist nichts ändern kann · keine Bezahlplan-Seite sichtbar ist.

## Schritt 6 — Akquise und Start

Vorhanden, seit 23.11. pausiert: Profil-Zyklus, stündlicher Versand mit Aufwärmkurve und Wächtern, Einladungsseite im Heft-Stil, Abmeldung mit einem Klick. Post heute über Resend; Angels Mailserver ist für pawn.vision eingetragen.

**Risiko:** E-Mail-Werbung braucht in Deutschland eine vorherige ausdrückliche, nachweisbare Einwilligung, auch B2B (IHK Stuttgart). Vor dem Neustart prüft ein Anwalt den Einladungsweg.

Ablauf: Angel findet Profile (Stil-Matrix) → PAWN-KI schreibt persönlich, mit den Werken des Hauses → Daouda gibt jede Welle frei → kleine Wellen, Abmeldung, Wächter → Haus zieht ein (Schritt 3) → Start ab Daoudas Schwelle.

**Fertig, wenn:** der Einladungsweg anwaltlich geprüft ist · jede Einladung mit echten Werken und Abmeldelink nach Daoudas Freigabe rausgeht · die Startschwelle erreicht ist und nur die Takt-Aufträge wieder laufen, die Daouda einzeln freigibt.

## Unabhängigkeit

| Bereich | Heute | Eigen | Stufe |
| --- | --- | --- | --- |
| Server, Datenbank, Anmeldung, Dateien | Lovable Cloud | Hetzner, Supabase selbst betrieben | 1 |
| Website | Vercel | eigener Server (Caddy) | 1 |
| Freistellen | fal | BiRefNet | 1 |
| Post | Resend | Angels Mailserver | 1 |
| Alle KI-Aufrufe | fest verdrahtet | KI-Weiche „eigen" / „Dienst" | 1 |
| Produktfoto, Ansichten | fal (Google) | Qwen-Image-Edit-2511 | 2 |
| Anprobe | fal (nano-banana-pro, Kling) | FASHN VTON v1.5 | 2 |
| Video | fal (Wan, Kling) | Wan 2.2 | 2 |
| Texte, Jarvis, Beratung | Anthropic, OpenAI, Lovable | über Angel | 3 |
| Zahlungen | Stripe | bleibt Stripe | — |

Kosten netto/Monat: Stufe 1 CPX32 36,49 € (später CX43 19,69 €) · Stufe 2 GEX45 (24 GB, Helsinki) 214 € + 209 € Einrichtung (Stand 13.10.2026).

**Erledigt am 24.11.:** IDM-VTON steht unter CC BY-NC-SA 4.0 (nicht kommerziell). Es ist aus Anprobe und Studio-Model-Fotos entfernt; ein Test schlägt an, falls es (in irgendeiner Schreibweise) zurückkommt. Wirksam mit dem nächsten Lovable-Deploy oder dem Umzug.

## Was nur Daouda entscheidet

- [ ] Server: A, B oder C (Schritt 1)
- [ ] Hetzner: Zwei-Faktor-Anmeldung einschalten
- [x] Anprobe live schalten — erledigt am 24.11. (#205 + Lovable-Deploy); offen nur noch #206 (Optik)
- [ ] Google-Anmeldung: eigener Zugang, Weiterleitung `https://api.pawn.vision/auth/v1/callback`
- [ ] Stripe: OK für die neue Webhook-Adresse
- [ ] Datenschutzerklärung: OK für Hetzner
- [ ] Bezahlpläne: Plan-Seite zum Start ausblenden
- [ ] KI-Kennzeichnung: Wortlaut (EU AI Act, Art. 50)
- [ ] Grafikkarten-Server: ab wann GEX45
- [ ] Akquise: Anwalt, Startschwelle, welche Takt-Aufträge wieder laufen
