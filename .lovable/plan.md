## Festgelegt

- **7 % Provision nur auf den Warenwert**, nie auf Versandkosten. Der Wert kommt weiterhin ausschließlich aus `ai_config.platform_commission` — an keiner Stelle hart verdrahtet.
- Versandkosten gehören vollständig dem Haus.
- Ziel: Zahlung entsteht **auf dem Stripe-Konto des Hauses** (Direct Charge), PAWN erhält automatisch die Application Fee.
- **Sprachregelung:** Keine rechtlichen Aussagen zur Parteistellung in UI, Rechtstexten oder Code-Kommentaren. Beschrieben wird ausschließlich die technische Stripe-Rollenverteilung („Die Zahlung wird über das Stripe-Konto deines Hauses abgewickelt", „Gebühren und Rückbuchungen werden Stripe-seitig deinem Konto belastet"). Rechtstexte werden in diesem Zug nicht angefasst.

---

## 1. Datenbankmigration
- `orders`: `stripe_payment_intent_id`, `stripe_charge_id`, `connected_account_id`, `refunded_amount_cents` (Standard 0), `dispute_status`, `paid_at`.
- `designers`: `stripe_payouts_enabled` (bool, Standard false), `stripe_requirements` (jsonb, offene Nachweise), `stripe_country` (text, Standard `DE`); Unique-Index auf `stripe_account_id`.
- Keine neuen Tabellen, daher keine neuen Policies/Grants nötig; bestehende Regeln decken die Spalten ab.

## 2. Stripe-Connect-Onboarding (`stripe-connect`)
- Kontoerstellung für Direct Charges: Stripe-Gebühren und Verlustübernahme liegen beim Connected Account, Express-Dashboard-Zugang aktiv.
- Land aus `designers.stripe_country` statt fest `DE`.
- `status` schreibt zusätzlich `payouts_enabled` und `requirements` zurück.
- Neue Aktion `dashboard`: Login-Link ins Stripe-Express-Dashboard (Auszahlungen, Belege, Streitfälle).

## 3. Direct-Charge-Checkout (`create-checkout`)
- Bestellung wird **vor** der Session angelegt, damit `order_id` in die Metadaten kann.
- Session wird auf dem Connected Account erzeugt (`{ stripeAccount: designer.stripe_account_id }`), `transfer_data` entfällt.
- `payment_intent_data.application_fee_amount` = `platform_commission` × **Warenwert ohne Versand** (bestehende Berechnung bleibt).
- Metadaten auf Session und PaymentIntent: `order_id`, `designer_id`, `platform: pawn`.
- Versandposition wird als eigene Zeile geführt und fließt nicht in die Fee-Basis.
- Unverändert: Abos und Credits laufen weiter über das Plattformkonto; Admin-eigene Häuser verkaufen weiter direkt über das Plattformkonto; `mixed_cart`/`designer_not_ready` bleiben als Sperren erhalten.

## 4. Connect-Webhooks
- Gemeinsame Logik (Bestellung bezahlt, Adresse, Bestandsabbau, Benachrichtigung, Bestätigungsmail) wandert nach `supabase/functions/_shared/orderPaid.ts`.
- Neue Funktion `stripe-webhook-connect` mit eigenem Signing Secret `STRIPE_CONNECT_WEBHOOK_SECRET`; Zuordnung über `event.account` + `metadata.order_id`. Verarbeitet: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`, `payout.paid`, `payout.failed`. Unbekannte Bestellungen werden still ignoriert (immer 200).
- Bestehender `stripe-webhook` behält Abos/Credits und bekommt zusätzlich `account.updated` (Konto-Status in `designers` aktualisieren, Hinweis bei offenen Nachweisen).
- Rückerstattung: setzt `refunded_amount_cents` und Status, benachrichtigt Haus und Käufer. Bei Vollerstattung wird die Application Fee ebenfalls zurückgegeben (`refund_application_fee`).
- Streitfall: setzt `dispute_status`, informiert das Haus sachlich mit Verweis auf sein Stripe-Dashboard.

## 5. Multi-Designer-Warenkorb
- Warenkorb gruppiert nach Haus: je Block eigene Zwischensumme, eigener Versand, eigener Knopf „Bei diesem Haus kaufen".
- Nach erfolgreicher Rückkehr werden nur die Zeilen dieses Hauses entfernt; der Rest bleibt liegen, mit Hinweis auf das nächste Haus.
- Ruhiger Hinweis: „Jedes Haus verkauft selbst — darum eine Zahlung pro Haus."
- Der interne Ledger-Fallback in `Checkout.tsx` bei technischem Fehler wird entfernt: keine „bestätigte" Bestellung ohne Zahlung mehr, stattdessen ehrliche Fehlermeldung.

## 6. Studio-Zahlungsstatus
- `/studio/auszahlung`: vier klare Zustände (nicht verbunden · Nachweise offen · Zahlungen aktiv · Auszahlungen aktiv), Link ins Stripe-Dashboard, sachliche Erklärung der technischen Gebühren-/Rückbuchungszuordnung.
- `/studio/bestellungen` und `/studio/versand`: Rückerstattungs- und Streitfall-Status sichtbar.

## 7. Prüfung & Übergabe
Nach der Umsetzung: Typecheck, Durchsicht des vollständigen Ablaufs (Onboarding → Kauf → Zahlung → Rückerstattung → Streitfall → Auszahlung) und eine präzise Liste deiner manuellen Schritte im Stripe-Dashboard — insbesondere Anlegen des **Connect-Webhook-Endpunkts** („Events on connected accounts"), Auswahl der Ereignistypen und Hinterlegen von `STRIPE_CONNECT_WEBHOOK_SECRET`. Das Secret fordere ich an, sobald die Endpunkt-URL existiert.

## Technische Notiz
`create-checkout`, `stripe-connect`, `stripe-webhook` und der neue `stripe-webhook-connect` müssen nach der Änderung neu ausgerollt werden (Deploy über Lovable). Frontend-Änderungen laufen wie gewohnt über Git.
