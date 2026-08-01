## Ursache (aus dem Server-Log belegt)

Beim Klick auf „Auszahlungskonto verbinden" ruft `stripe-connect` `accounts.create({ type: "express" })` auf. Stripe antwortet mit HTTP 400:

```text
Please review the responsibilities of managing losses for connected accounts
at https://dashboard.stripe.com/settings/connect/platform-profile
```

Das ist **kein Code-Fehler**. Stripe verlangt, dass im Plattform-Konto einmalig das **Connect-Plattform-Profil** ausgefüllt wird (u. a. wer Verluste/Rückbuchungen der verbundenen Konten trägt), bevor überhaupt ein verbundenes Konto angelegt werden darf. Solange das fehlt, schlägt jeder Onboarding-Versuch fehl — die Function fängt den Fehler ab und zeigt den freundlichen Text „Auszahlungen werden gerade eingerichtet".

## Lösung

**Schritt 1 — Du im Stripe-Dashboard (behebt den Fehler tatsächlich)**
1. Stripe Dashboard → Einstellungen → Connect → **Plattform-Profil**.
2. Alle Fragen beantworten (Geschäftsmodell, was die verbundenen Konten verkaufen, Länder).
3. Beim Punkt **„Verantwortung für Verluste"**: PAWN nutzt Direct Charges mit Application Fee → hier trägt das **verbundene Konto (der Designer)** Gebühren und Rückbuchungen. Diese Option wählen (Stripe nennt sie „connected account is responsible for losses"/„Express"-Voreinstellung).
4. Profil separat für **Testmodus und Live-Modus** ausfüllen — die Profile sind getrennt.

**Schritt 2 — Code (klein, damit so etwas nie wieder unsichtbar bleibt)**
In `supabase/functions/stripe-connect/index.ts` den Catch-Block präzisieren:
- Bei `StripeInvalidRequestError` mit Plattform-Profil-Bezug einen eigenen Fehlercode `platform_setup_required` zurückgeben statt des generischen `internal_error`.
- In `src/pages/studio/StudioPayout.tsx` diesen Fall abfangen und dem Designer sagen: „PAWN schließt gerade die Freigabe beim Zahlungspartner ab — dein Konto kannst du gleich verbinden." (statt der jetzigen Wolke aus Nichts), und dir als Admin die echte Stripe-Meldung im Log/Adminbereich zeigen.
- Kein weiterer Umbau an Checkout, Webhooks oder Fee-Logik.

## Technische Details

- Fehlerquelle: `stripe.accounts.create` in `stripe-connect`, Action `onboard`.
- `stripe_account_id` wurde folglich nie gespeichert — es gibt keine halbfertigen Konten aufzuräumen.
- Die Änderung an `stripe-connect` erfordert einen Lovable-Deploy der Edge Function (kostet Credits); die Frontend-Meldung geht über Git.

Hinweis: Schritt 2 macht den Fehler nur sichtbar — verbinden lässt sich ein Auszahlungskonto erst nach Schritt 1.
