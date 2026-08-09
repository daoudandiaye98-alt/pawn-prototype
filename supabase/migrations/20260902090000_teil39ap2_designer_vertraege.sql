-- Teil 39 AP2 — von Skelett-Verträgen zu echten, P2B-konformen Dokumenten. Neue Versionen je
-- Vertragsart (alte Version bleibt über effective_to geschlossen, contract_versions selbst wird
-- nie überschrieben — Revisionssicherheit). Ranking-Vertrag ist neu (kind='ranking').

UPDATE public.contract_versions SET effective_to = now()
WHERE kind IN ('designer','commission','image_usage','ai_marketing','designer_terms') AND effective_to IS NULL;

INSERT INTO public.contract_versions (kind, version, title, body_markdown, checksum, effective_from) VALUES

('designer', 3, 'Designer-Vertrag mit PAWN (v3)',
$MD$**Vorläufige Fassung — anwaltliche Prüfung ausstehend.**

## 1. Parteien
Zwischen der PAWN-Plattform (Betreiber: siehe Impressum unter pawn.vision/impressum) und der/dem unabhängigen Designer:in ("Haus").

## 2. Leistungen von PAWN
- **Bühne**: kuratierte Präsentation im PAWN-Katalog (Mode / Interior / Kunst).
- **Türen**: automatisierte Vermittlung von Presse-, Kollektions- und Kooperations-Gelegenheiten.
- **Kampagnen-Studio**: browserbasiertes Video-Rendering + optionaler KI-Bewegtbild-Modus.
- **KI-Assistenz (PAWN)**: personalisierte Empfehlungen, Trend-Report, Studio-Begleiter.
- **Zahlungsabwicklung**: Stripe Connect — Kaufpreise fließen direkt an das Haus, PAWN erhält nur die Provision.

## 3. Wirtschaftliche Bedingungen
- **Provision**: 7% vom Bruttoverkaufspreis je verkauftem Stück, nach § 4 der AGB. Änderungen der Provision werden mindestens 30 Tage im Voraus angekündigt und gelten nicht rückwirkend für bereits gezahlte Bestellungen.
- **Pläne**: Frei (0€/Monat, Basiszugang) und Paid (Preis einsehbar unter /studio/plan). Bestehende Atelier-Abos laufen zu ihrem ursprünglichen Preis unverändert weiter. Jederzeit kündbar über /vertrag-kuendigen, keine Mindestlaufzeit.
- **Auszahlung**: laufend über Stripe Connect, sobald ein Kauf abgeschlossen und die gesetzliche Widerrufsfrist berücksichtigt ist.

## 4. Änderungen dieses Vertrags (P2B-VO)
Wesentliche Änderungen dieses Vertrags kündigt PAWN mindestens **15 Tage** im Voraus an (bei einschneidenden Änderungen entsprechend länger); die Änderung gilt ab dem angekündigten Datum als angenommen, wenn das Haus nicht widerspricht oder den Vertrag zuvor kündigt. Änderungen erscheinen als Zustimmungs-Hinweis im Studio (kein Zwang zur sofortigen Bestätigung, siehe § 8).

## 5. Aussetzung und Beendigung durch PAWN (P2B-VO)
PAWN kann ein Haus-Konto aus wichtigem Grund (z. B. Rechtsverstoß, Täuschung, wiederholte Kundenbeschwerden) einschränken, aussetzen oder beenden. In diesem Fall erhält das Haus vorab eine **Begründung in Textform** sowie, außer bei gesetzlicher Pflicht zur sofortigen Sperrung, eine **angemessene Frist zur Stellungnahme**. Eine dauerhafte Kündigung wird mit mindestens 30 Tagen Vorlauf angekündigt, sofern kein wichtiger Grund eine sofortige Beendigung erfordert.

## 6. Beschwerdeverfahren
Ein Haus kann jederzeit über eine Nachricht im Studio ("Kontakt" / Nachrichten-Zentrum) Beschwerden zu Ranking, Aussetzung, Kündigung oder Vertragsauslegung einreichen. PAWN bestätigt den Eingang und antwortet in angemessener Frist. Unabhängig davon steht der Weg zur Mediation offen (siehe § 12 AGB, EU-Streitbeilegungsplattform).

## 7. Bildrechte
Das Haus räumt PAWN das nicht-exklusive, weltweite Nutzungsrecht an hochgeladenen Bildern/Videos zu Präsentations- und Marketingzwecken ein. **Widerruflich** durch Löschung des Studios oder Anfrage per Nachricht — PAWN entfernt betroffene Assets binnen 14 Tagen. Details zur KI-gestützten Bildnutzung: siehe Vertrag "KI-Nutzungsrechte" (kind ai_marketing).

## 8. Laufzeit & Kündigung
Unbefristet. Kündigung durch das Haus jederzeit zum Ende der laufenden Abrechnungsperiode über /vertrag-kuendigen. Kündigung durch PAWN mit 30 Tagen Frist zum Monatsende, außer in den Fällen von § 5. Studio bleibt bis Ende der jeweiligen Frist aktiv.

## 9. Datenverarbeitung
Verarbeitung nach DSGVO. Details in /datenschutz. Kundendaten (Bestell-/Nachrichtendaten) werden dem Haus nur pseudonymisiert (z. B. "User 3") übermittelt — Klarnamen nur zur Fulfillment-Notwendigkeit.

## 10. Sonstiges
Gerichtsstand Deutschland, deutsches Recht. Sollte eine Klausel unwirksam sein, bleibt der Rest wirksam.
$MD$, md5('designer-v3-2026-09-02'), now()),

('ranking', 1, 'Wie das Schach-Ranking funktioniert',
$MD$**Vorläufige Fassung — anwaltliche Prüfung ausstehend.**

PAWN ordnet Häuser nicht nach Zufall oder gegen Bezahlung, sondern nach einer nachvollziehbaren Reihenfolge — dem "Rang" (Bauer → Läufer → Turm → Dame).

## Was in die Reihenfolge einfließt
- **Vollständigkeit des Profils**: Marken-Geschichte, Fotos, Produktangaben.
- **Aktivität**: wie regelmäßig neue Stücke, Kampagnen oder Aktualisierungen erscheinen.
- **Verkaufs- und Interaktionssignale**: Klicks, Verweildauer, abgeschlossene Käufe — aggregiert, nie einzelne Kundendaten.
- **Passung zu Kundennachfrage**: wie gut ein Haus zu dem passt, wonach Besucher:innen gerade suchen (siehe Datenschutzerklärung, Abschnitt 4).

## Was NICHT einfließt
**Kein Parameter dieses Rankings ist gegen Bezahlung erhältlich.** Ein höherer Plan (Paid statt Frei) kauft keinen besseren Rang — er schaltet zusätzliche Werkzeuge frei (mehr Videos, mehr KI-Kontingent), die indirekt zu mehr Aktivität führen können, aber die Bewertung selbst bleibt unabhängig vom gebuchten Plan.

## Gewichtung
Die relative Gewichtung der einzelnen Signale ist ein sich entwickelndes System (`ai_config.matching_weights`) und kein starres Punkteschema — PAWN passt sie fortlaufend an, um Qualität und echte Passung abzubilden, nicht reine Menge.

## Deine Rechte
Du kannst jederzeit im Studio unter "Beweis" einsehen, wie dein Haus aktuell abschneidet, und über eine Nachricht Fragen zu deiner Einordnung stellen.
$MD$, md5('ranking-v1-2026-09-02'), now()),

('commission', 2, 'Revenue Share',
$MD$**Vorläufige Fassung — anwaltliche Prüfung ausstehend.**

PAWN behält **7% des Bruttoverkaufspreises** je Bestellung als Vermittlungsprovision (`ai_config.platform_commission`). Der verbleibende Betrag fließt über Stripe Connect direkt an das Haus — PAWN hält das Geld zu keinem Zeitpunkt selbst.

**Auszahlung**: laufend, sobald ein Kauf abgeschlossen ist, abzüglich der Provision und etwaiger Rückerstattungen/Stornierungen.

**Änderungen** der Provisionshöhe werden mindestens 30 Tage im Voraus angekündigt (P2B-VO) und gelten nicht rückwirkend für bereits abgeschlossene Bestellungen.

**Abo-Zahlungen** (Plan Paid) sind unabhängig von der Verkaufsprovision und fließen direkt an PAWN als Plattformbetreiber.
$MD$, md5('commission-v2-2026-09-02'), now()),

('image_usage', 2, 'Einwilligung Bildnutzung',
$MD$**Vorläufige Fassung — anwaltliche Prüfung ausstehend.**

Du erlaubst PAWN, die von dir eingereichten Bilder und Videos für Ausstellungs-, Redaktions- und Werbezwecke auf pawn.vision sowie in offiziellen PAWN-Kommunikationskanälen (Social Media, Presseanfragen, Première-Sektion) zu verwenden. Die Bildrechte selbst verbleiben bei dir.

Diese Einwilligung ist getrennt von der Zustimmung zur **KI-gestützten Erzeugung** neuer Aufnahmen aus deinen Produktfotos (Anprobe-Bilder, Produktfotos, Kampagnen-Videos) — siehe den Vertrag "KI-Nutzungsrechte" (kind ai_marketing).

Du kannst diese Einwilligung jederzeit im Studio unter Einstellungen widerrufen; laufende Kampagnen mit diesen Bildern werden dann pausiert.
$MD$, md5('image_usage-v2-2026-09-02'), now()),

('ai_marketing', 2, 'KI-Nutzungsrechte',
$MD$**Vorläufige Fassung — anwaltliche Prüfung ausstehend.**

## Was PAWN mit KI aus deinen Bildern erzeugt
Aus den Produktfotos, die du hochlädst, erzeugt PAWN auf deinen Wunsch: Anprobe-Darstellungen (Try-On, über fal.ai), freigestellte Produktfotos, und kurze Kampagnen-Videos (über fal.ai bzw. WAN). Die erzeugten Ergebnisse zeigen niemals eine reale, existierende Person — Anprobe-Modelle sind synthetisch erzeugt oder aus einem lizenzierten Modell-Pool.

## Zweckbindung
Erzeugte Aufnahmen dienen zunächst der Präsentation deines eigenen Hauses. Ob PAWN ausgewählte Aufnahmen zusätzlich zur Werbung für die Plattform selbst nutzen darf (Landing-Page, PAWN-Kanäle, mit Namensnennung und Verlinkung deines Hauses), entscheidest du separat über die einmalige Zustimmung zu den Medienrechten im Studio (`designers.media_rights_granted_at`).

## Widerruf
Beide Zustimmungen (eigene Nutzung / Plattform-Werbung) sind getrennt jederzeit im Studio widerrufbar. Ein Widerruf wirkt nicht rückwirkend auf bereits veröffentlichtes Material, verhindert aber jede künftige Verwendung.

## Kennzeichnung
Alle KI-erzeugten Darstellungen mit synthetischen Personen tragen ein sichtbares Hinweiszeichen ("KI-generiert") im Player und in geteilten Ausspielungen — Details siehe Datenschutzerklärung und die Hilfe-Seite "Wie PAWN KI nutzt".
$MD$, md5('ai_marketing-v2-2026-09-02'), now()),

('designer_terms', 2, 'PAWN Haus-Ordnung',
$MD$**Vorläufige Fassung — anwaltliche Prüfung ausstehend.**

Als Haus auf PAWN verpflichtest du dich:
- deine Arbeit ehrlich darzustellen (echte Fotos, korrekte Maße/Materialien, keine irreführenden Angaben),
- Kundenanfragen und Bestellungen innerhalb angemessener Frist zu bearbeiten,
- die auf der Produktseite genannten Lieferzeiten einzuhalten oder Verzögerungen aktiv zu kommunizieren,
- die dir zugeteilten KI-Kontingente (Videos, Shots, Signaturen) im Rahmen deines Plans fair zu nutzen — automatisiertes Massen-Erzeugen zur Umgehung der Kontingente ist nicht gestattet.

PAWN behält sich vor, Inhalte zu entfernen, die gegen diese Ordnung, geltendes Recht oder Rechte Dritter verstoßen — mit Begründung, siehe § 5 des Designer-Vertrags.
$MD$, md5('designer_terms-v2-2026-09-02'), now())

ON CONFLICT (kind, version) DO NOTHING;
