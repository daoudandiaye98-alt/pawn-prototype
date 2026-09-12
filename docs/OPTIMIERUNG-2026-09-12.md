# PAWN — Optimierungsrunde 12.09.2026

Urspruengliche Messbasis: origin/main 8379bd0 (PR #194).
Vor Uebergabe auf origin/main 8f1e3b4 aktualisiert, einschliesslich der danach hinzugekommenen
Studio-/Adminseiten, Freistellung und Anprobe. Eigener Zweig und eigene Arbeitskopie.

## Was sich aendert

- 70 Seiten werden erst beim Aufrufen geladen. Das gemeinsame Heft und seine Provider
  bleiben bestehen. Der Einstieg schrumpft von 2 187 402 auf 896 607 Byte
  (gzip: 600 584 auf rund 264 490 Byte), gemessen vor der Integration neuer Hauptzweig-Aenderungen.
  Der abschliessende Bau mit Hauptzweig 8f1e3b4 liegt bei 897 946 Byte
  (gzip 264 889 Byte), weiter unter dem 1,1-MB-Budget.
  Das ist das statische Start-JavaScript, keine Behauptung ueber die gesamte Heft-Ladezeit.
- Der Build liefert pawn-build.json mit Commit und Kennzeichnung lokaler Aenderungen.
  Der Browser-Pruefstand wartet auf genau diesen unveraenderten Bau. Ein alter Live-Stand,
  ein SPA-Fallback oder ein frueherer erfolgreicher Deploymentstatus genuegen nicht.
- Die CI prueft Typen, Verhalten, Regressionen, Bau, Startgewicht und isolierte Browserwege
  vor der getrennten Pruefung der ausgelieferten Website.
- Das Start-JavaScript hat eine Obergrenze von 1,1 MB. Neue Ueberschreitungen stoppen die CI.
- Der Vorschau-Zugangsschluessel wird nur an den durch das Deployment bestaetigten Origin
  geschickt. Manuelle fremde Vorschauadressen, Drittanbieter und fremde Weiterleitungsziele
  erhalten ihn nicht. Die unabhaengige Codepruefung hatte diese Luecke aufgedeckt.
- Regressionen- und Fokus-Waechter erkennen ihre bestehenden Pfadausnahmen jetzt auch
  unter Windows. Der Heft-Testbericht verwendet auf allen Node-Versionen dasselbe TAP-Format.
- Im mobilen Lesemodus stehen Kapitel/Pagination und Lesehinweis in getrennten Zeilen;
  die Blaetterpfeile haben 44-Pixel-Trefferflaechen.
- Obsidian: PAWN.md als Einstieg, erzeugter Git-Schnappschuss mit Verweisen auf das Repo.
  Produktentscheidungen stehen in PAWN-ENTSCHEIDUNGEN.md. Stale Merge-Angaben wurden berichtigt.
- Die Mediathek kann transparente PNG/WebP-Dateien als Heft-Aufsteller verknuepfen.
  Echte Alphawerte werden geprueft, Kopien ueber ihren Inhalt wiedererkannt und in
  designer-media gespeichert. Eine unerreichbare oeffentliche Kopie wird nicht verknuepft.
  Originalbild und uebrige Produkt-DNA bleiben erhalten. Gleichzeitige DNA-Aenderungen
  werden ueber einen Vergleich beim Speichern erkannt.
- seed-testaccounts bleibt als nebenwirkungsfreier HTTP-410-Tombstone bestehen.
  Die Funktion enthaelt keine Zugangsdaten und baut keine Datenbankverbindung auf.

## Auslieferung

Frontend und Pruefablauf: Git-PR. Keine neue Tabelle, Policy oder Migration.

**Gesondert ueber Lovable:** seed-testaccounts und dessen verify_jwt-Einstellung
aus diesem Zweig ausliefern. Nur eine Datei in Git zu loeschen wuerde die bisher
laufende Funktion nicht entfernen; deshalb wird eine stillgelegte Fassung deployt.
Anschliessend unauthentifiziert 401 oder 410 und authentifiziert 410 nachweisen.
Vor der Stilllegung KEINEN Probeaufruf an die alte Funktion senden: er koennte Konten aendern.

## Bewusst noch offen

- Der neue Aufsteller-Weg verarbeitet vorhandene Freistellungen. Er ist kein neuer
  automatischer KI-Dienst. generate-product-shot erzeugt weiterhin ein Studiofoto mit
  Hintergrund; die Mediathek bezeichnet es deshalb jetzt als Studiofoto.
- Der inzwischen weiterentwickelte Hauptzweig enthaelt bereits freistellen und anprobe.
  Diese Runde ersetzt diese Dienste nicht. Es fehlen weiterhin 20 echte autorisierte
  Produktfotos und eine Qualitaets-/Kostenabnahme. Beide Wege verwenden
  product_dna.heft.cutout_url; die Mediathek erlaubt die manuelle, gepruefte Zuordnung.
- Die Bucket-Voraussetzungen sind in vorhandenen Migrationen beschrieben. Ob sie auf der
  aktuellen Datenbank bereits gelten, ist kein Ergebnis der isolierten Browsertests.
- Frischer Aufbau der gesamten Datenbank, Secret-Rotation und der echte Stripe-Testmodus
  benoetigen eine getrennte Betriebsabnahme. Keine historische Migration wurde angefasst.
- Kein Server wurde gemietet, kein lokales KI-Modell installiert und kein Angel-Prozess beendet.

## Wiederholen

Agenten fuehren im Repository aus:

- `bash scripts/verify/verify.sh schnell`
- `npm run build` und `npm run build:gewicht`
- `node scripts/verify/wege-smoke.mjs` (Browser mit ausschliesslich isolierten Backend-Antworten)
- `npm run stand -- --vault "C:/Users/dodon/Daoudas Arbeit"`

Die letzte Zeile erzeugt nur eine eindeutig markierte Stand-Datei im vorhandenen Vault;
sie ueberschreibt keine fremde Notiz. Code bleibt im Repository.

## Integration mit laufender Entwicklung

- Neue Verwaltungsseiten AdminBegleiter, AdminArchetypen und StudioHeft bleiben erhalten
  und werden ebenfalls bedarfsweise geladen. Die Entfernung des alten EditMode bleibt erhalten.
- Die isolierten Browserantworten bedienen nun auch heft_produkte/heft_haeuser, weil der
  Hauptzweig inzwischen diese Sichten aktiviert hat.
- main ergaenzte drei Entwicklungsabhaengigkeiten und bun.lock, aber nicht package-lock.json.
  Die npm-Lockdatei wird synchronisiert, damit npm ci in GitHub Actions wieder reproduzierbar ist.
- Historische offene Betriebsfragen vom 11.09. stehen im Stand jetzt als historische Liste;
  sie sind keine Behauptung ueber den heutigen Datenbankzustand.

- Die neue Hauptzweig-Fassung liess drei neue Routen in routen.js/vercel.json aus.
  Der bestehende Routentest wurde daran rot. Beide Register sind jetzt synchronisiert;
  neue Seiten erhalten auch beim direkten Aufruf eine passende Auslieferungsregel.
