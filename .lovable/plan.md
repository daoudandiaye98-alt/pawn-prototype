## Teil 1 — E-Mail: was geht, was nicht

Geprüft im Code und in der Konfiguration:

- **Anzeige-/Kontaktadresse** ist bereits `pawnstudio.co@gmail.com`: in `business_profile` (Datenbank), Impressum, AGB, Widerruf.
- **Absenderadresse beim Versand** ist etwas anderes: In `akquise_config.email_from` und in den Bestell-Mails steht fest `PAWN <hallo@pawn.vision>`, Antwortadresse `pawnstudio.co@gmail.com`.
- Zwei Stellen sind noch Platzhalter aus der Vorlage: Footer-Link „Contact" → `kontakt@pawn.example`, und Datenschutz-Seite (`kontakt@pawn.example`, `datenschutz@pawn.example`).

Wichtige Einschränkung, ohne Fachjargon: **Resend kann nicht von einer Gmail-Adresse aus versenden.** Um über einen Versanddienst zu senden, muss die Absender-Domain nachweislich dir gehören (DNS-Einträge). `gmail.com` gehört Google, nicht dir — Google verbietet fremden Versand in eigenem Namen ausdrücklich. Mails „von" `pawnstudio.co@gmail.com` würden bei Gmail/Outlook im Spam landen oder direkt abgelehnt.

Damit gibt es genau zwei saubere Wege:

**A (empfohlen): pawn.vision als Absender, Gmail als Antwortadresse.** Für den Empfänger steht „PAWN" im Posteingang, Antworten landen in deinem Gmail-Fach. Deine To-dos in Resend: Domain `pawn.vision` hinzufügen, die drei angezeigten DNS-Einträge (SPF, DKIM, optional DMARC) bei deinem Domain-Anbieter eintragen, auf „verified" warten. Danach funktionieren Bestellbestätigungen, Rechnungen und Akquise-Mails.

**B: Gmail als sichtbarer Absender.** Nur möglich, wenn du in Gmail „Senden als" mit deiner eigenen Domain kombinierst — heißt praktisch: du brauchst trotzdem eine eigene Domain. Kein Vorteil gegenüber A.

Was ich baue (unabhängig von A/B, kostenlos über Git):
- Alle `pawn.example`-Platzhalter (Footer, Datenschutz) durch `pawnstudio.co@gmail.com` ersetzen; Datenschutz-Seite bekommt Name/Anschrift aus `business_profile` statt „TODO".
- Eine einzige Wahrheit für Kontakt: alle Rechtstexte und der Footer lesen `business_profile.contact_email`.
- Antwortadresse konsequent auf `pawnstudio.co@gmail.com` in allen Versandwegen (Bestellung, Rechnung, Akquise, Follow-up) — auch dort, wo bisher nichts gesetzt war.
- Absenderadresse bleibt konfigurierbar in der Datenbank; sobald `pawn.vision` in Resend verifiziert ist, ändert sich nichts mehr im Code.

## Teil 2 — Abo-System: Bestandsaufnahme

Ist-Zustand: Haus 0 € · Atelier 24 € · Maison 99 €, dazu ein **zweites, paralleles System** aus Credits (Haus 30, Atelier 300, Maison 1200), Preislisten je Handlung (Freisteller 1, Model-Shot 2, Model-Clip 8, Clip 5/12/20) und drei Nachkauf-Paketen. Die Pakete haben **keine Stripe-Preis-IDs** — Nachkauf ist heute nicht kaufbar. Aktuell ist genau 1 Haus im System (Maison). Es gibt also keine Bestandskunden, die eine Umstellung schmerzt: der beste Moment, das zu vereinfachen.

Kernproblem: PAWN verspricht Designern, dass Technik verschwindet und Handwerk sichtbar wird. Ein Guthabenstand, Kostentabellen pro Klick und ein Kreisdiagramm über verbrauchte Einheiten machen genau das Gegenteil — der Designer rechnet, statt zu gestalten. Zusätzlich zahlt er zweimal Aufmerksamkeit: Abo plus Verbrauch. Für den Betreiber ist die Kostenkontrolle nötig — aber die läuft ohnehin schon unsichtbar über das interne KI-Budget (`ai_budget_ledger`).

## Teil 3 — Entscheidung: Credits raus, Kontingente rein

**Credits werden gestrichen.** An ihre Stelle treten verständliche Monats-Kontingente in echten Dingen, keine Punkte:

- **Haus · 0 €** — 3 Videos, 5 Model-Shots, 5 Freisteller, 1 Signatur-Kostprobe, PAWN-Emblem im Video.
- **Atelier · 24 €** — 15 Videos (8 davon kinematisch, ohne Emblem), 25 Model-Shots/Freisteller, 3 Signaturen, KI-Kurator, Text-Atelier, PAWN+ Denkstufe.
- **Maison · 99 €** — 40 Videos, alle kinematisch, unbegrenzt Shots, alle Signaturen + Wunsch-Signatur, Haus-Dossier, Vitrine-Rotation, Première-Priorität, Editionen-Erstzugang.

Warum das besser zur Mission passt: Ein Designer versteht „3 Videos diesen Monat" sofort. „30 Credits" muss er erst in Videos umrechnen — das ist Buchhaltung, nicht Atelier. Kontingente sind außerdem ehrlicher: sie sagen, was er bekommt, nicht was er verbraucht.

Was mit dem Guthaben-Nachkauf passiert: **entfällt.** Wer mehr will, steigt eine Stufe hoch — eine Entscheidung statt einer Dauer-Mikrorechnung. Der Kostendeckel für PAWN bleibt über das interne Budget bestehen und wird nur sichtbar, wenn ein Haus wirklich anschlägt („Dein Kontingent für diesen Monat ist aufgebraucht — am 1. ist es wieder da, oder wechsle ins Atelier.").

## Teil 4 — Inszenierung der Plan-Seite

Die Seite wird von einer Preistabelle zu einer Standortbestimmung:

1. **Kopf:** eine Zeile, die nie verhandelt wird — „7 % bleiben immer 7 %. Pläne sind optional." Damit ist klar: kein Plan ist nie eine Strafe.
2. **Drei Stufen als Erzählung** statt Feature-Listen, jede mit einem Satz, für wen sie gedacht ist („Alles, um live zu sein." / „Wenn du regelmäßig veröffentlichst." / „Für Ateliers im Serienbetrieb."), darunter höchstens fünf Punkte in echter Sprache.
3. **Beweis statt Behauptung:** je Stufe ein echtes Beispielvideo aus dem Archiv (Haus mit Emblem, Atelier kinematisch, Maison Signatur) — der Unterschied wird gesehen, nicht gelesen.
4. **Dein Monat:** eine ruhige Zeile statt Kreisdiagramm — „Diesen Monat: 2 von 3 Videos, 4 von 5 Shots." Kein Guthaben, keine Preisliste.
5. **Kein Dauer-Druck:** Der Hinweis auf die nächste Stufe erscheint nur an der Stelle, an der ein Kontingent tatsächlich endet — nicht als Banner über allem.

## Technische Details

- `ai_config`: `plan_limits` wird zur einzigen Wahrheit (Videos, kinematische Videos, Shots, Signaturen, Emblem-Flag je Stufe); `plan_credits`, `credit_costs`, `credit_packs` entfallen. Nichts hart im Code.
- `src/features/campaign/quota.ts`: `useCredits` wird zu `usePlanQuota` (Verbrauch je Handlungsart im Monat aus `ai_actions_log`/`generation_requests` statt Punktesaldo). `credits_ledger`/`book_credit_spend` bleiben unangetastet in der Datenbank (keine Migration nötig), werden aber nicht mehr gelesen.
- Aufrufer: `StudioPlan.tsx`, `StudioCampaignNew.tsx`, `StudioMediathek.tsx`, `StudioProducts.tsx`, `StudioStueckNeu.tsx`, `Begleiter.tsx` — überall Guthaben-Anzeige durch Kontingent-Anzeige ersetzen.
- Der Credits-Zweig in `create-checkout` (`mode: "credits"`) und die Gutschrift im `stripe-webhook` bleiben im Code liegen (kein Deploy nötig), das UI ruft ihn nicht mehr auf.
- E-Mail-Teil: `PublicFooter.tsx`, `Datenschutz.tsx`, `order-fulfillment`, `_shared/orderPaid.ts`, `pawn-jarvis` (Reply-To). Die drei Function-Änderungen erfordern **einen** Deploy — ich sage Bescheid, wenn er dran ist.
- Typecheck grün vor Abschluss; Prüfung auf 390 px.

## Was du selbst tun musst

1. In Resend `pawn.vision` als Domain hinzufügen und die angezeigten DNS-Einträge beim Domain-Anbieter eintragen (das ist der einzige Weg zu zuverlässigem Versand).
2. Bestätigen, dass Atelier 24 € / Maison 99 € so bleiben — die bestehenden Stripe-Preise ändere ich nicht.
