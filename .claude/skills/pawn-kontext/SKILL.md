---
name: pawn-kontext
description: Das Betriebswissen über PAWN — welche Datenbank die echte ist, was Lovable veröffentlicht und was ein GitHub-Merge live schaltet, wie Pläne, Guthaben, Stripe Connect, das Video-Archiv, Signaturen, Editionen und Jarvis wirklich zusammenhängen, und wo im Code was liegt. IMMER laden, bevor du eine dieser Fragen beantwortest oder Code anfasst, der sie berührt. Trigger: „welche Tabelle", „wo liegt", „warum kostet das Guthaben", „kann ich das deployen", „was passiert bei einem Merge", „welcher Plan darf", „wie kommt das Geld zum Designer", „was macht Jarvis", „Edge Function", „Supabase", „Lovable", „Credits", „planGate", „ai_config", „designer_level" — und immer dann, wenn du sonst über PAWNs Aufbau raten müsstest. Rate nie. Lade den Skill.
---

# PAWN — das Betriebswissen

## Die eine Regel, die dich am häufigsten rettet

> **Löst der Datenbank-Name nicht auf, prüfe zuerst das Lovable-Guthaben.**

`rnakubexbqfgfciynqpt.supabase.co` antwortet nicht mehr? Das ist fast nie ein
Netzproblem und fast immer ein aufgebrauchtes Lovable-Guthaben — die verwaltete
Instanz wird dann pausiert. Erst das prüfen, dann alles andere.

## Was wo live geht

| Was du änderst | Wie es live kommt | Kostet |
|---|---|---|
| Alles unter `src/`, `public/`, Konfiguration | Push auf `main` → Lovable synct → Vercel spiegelt auf pawn.vision | nichts |
| `supabase/functions/*` | **nur** über den Lovable-Agenten | Guthaben |
| `supabase/migrations/*` | **nur** über den Lovable-Agenten, VOR dem Code, der sie braucht | Guthaben |

Ein Agent kann eine Edge Function **ändern**, aber nie **ausliefern**. Nach jeder
Änderung an `supabase/functions/` gehört ein Satz in den Bericht: *„Daouda, hier
ist ein Lovable-Deploy nötig."* Ein eigener Deploy-Versuch ist immer falsch.

Die Vorschau `id-preview--…lovable.app` ist nur mit angemeldeter Lovable-Sitzung
erreichbar. Öffentlich prüfbar sind `pawn-archive-muse.lovable.app` und
`pawn.vision`.

## Geheimnisse
`STRIPE_SECRET_KEY`, `FAL_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
`STRIPE_WEBHOOK_SECRET` liegen ausschließlich in Lovable/Supabase. Nie
hardcoden, nie in `.env`, nie erfragen. `.env` trägt nur öffentliche
`VITE_`-Werte — und der Hook `geheimnisse.sh` blockiert den Zugriff darauf.

## Pläne, Guthaben, Grenzen — eine Wahrheit

Drei kaufbare Pläne: **Haus** (`haus`, 0 €), **Atelier** (`atelier`, 19 €),
**Maison** (`maison`, 79 €).

**Eine einzige Quelle** für alles, was ein Plan kostet und erlaubt: der Schlüssel
`ai_config.plans`, Feld `plaene.<plan>` mit `eur_month`, `stripe_price_id`,
`model_tier`, `budget_cents_month`, `credits_per_month`, `limits.*`. Die alten
Schlüssel `plan_prices` / `plan_limits` / `plan_credits` / `ai_budget_limits`
existieren **nicht mehr**.

Gelesen wird ausschließlich über `planGate` — `src/lib/planGate.ts` im Browser,
`supabase/functions/_shared/planGate.ts` auf dem Server. **Nie direkt aus
`ai_config`.** `planGate` hardcodet keine Grenzwerte, nur die TYP-Zuordnung je
Funktion (`monat` / `bestand` / `schalter`): *wie* eine Zahl zu lesen ist, nie
*welche* Zahl gilt.

Serverseitig ist `checkAndCount()` die einzige Stelle, die zugleich prüft und
zählt (Tabelle `plan_usage`, atomare RPC `plan_usage_inkrement`). Ist das interne
Cent-Budget erschöpft, wird bei zahlenden Plänen **degradiert** (Standard-Modell)
statt hart blockiert.

Video, Try-On und Produkt-Shots laufen **nicht** über `limits`, sondern über die
Guthaben-Kasse (`credits_ledger` / `book_credit_spend`). Ihr Monatsguthaben kommt
aus `plaene.<plan>.credits_per_month`. Das Wort „Credits" ist aus der Oberfläche
getilgt — dort heißt es **Guthaben**. Gesperrte Funktionen zeigt
`src/components/Gesperrt.tsx`: was, warum, und entweder ein
Plan-Wechsel-Knopf **oder** ein Reset-Datum, nie beides.

Ein Wechsel zwischen zwei laufenden Bezahlplänen läuft **nie** über einen zweiten
Checkout, sondern als begleitete Anfrage über `message_threads` — sonst laufen
zwei Abos parallel.

> **Rang ist nie käuflich.** `designer_level` (RPC) entsteht aus dem, was ein Haus
> baut und verkauft. `planGate` kennt nur Plan → Funktion, nie Plan → Rang.

## Stripe Connect — das Geld fließt direkt zum Designer

Produktkäufe (nicht Abos) werden beim Bezahlen geteilt: **93 % direkt** auf das
Stripe-Konto des Designers, **7 %** (`ai_config.platform_commission`) als
Plattformgebühr an PAWN. Designer-Geld liegt nie auf PAWNs Konto.

Voraussetzung: der Designer hat sein Konto über `/studio/auszahlung` verbunden
(Edge Function `stripe-connect`, Express-Account) und `stripe_charges_enabled`
steht auf `true`. Ohne aktives Connect-Konto blockiert `create-checkout` den Kauf
freundlich. Ausnahme: Häuser, die einem Admin gehören (Join über `user_roles`),
verkaufen weiterhin direkt an die Plattform.

Ein Checkout = ein Haus. Gemischte Warenkörbe werden abgelehnt.
Abo-Zahlungen (Atelier/Maison) bleiben direkter PAWN-Umsatz.

**Falle:** `create-checkout` darf **keinen** `automatic_payment_methods`-Parameter
bekommen.

## Video-Archiv

Jedes erzeugte Video — vom Browser-Renderer wie von den kinematischen fal-Clips
über `poll-broll` — landet in `video_assets` (`designer_id`, `campaign_id`, `url`,
`source` designer/edition/jarvis, `video_dna` jsonb, `rights_granted`, `premiere`,
`performance` jsonb).

Vor dem ersten Render muss ein Haus einmalig zustimmen
(`designers.media_rights_granted_at`, getrennt von `image_usage_consent`): PAWN
darf ausgewählte Videos mit Credit und Verlinkung zeigen.

`/admin/archiv` zeigt alle Videos aller Häuser; der Stern setzt eine Première, der
Pfeil schickt die Kampagne in die `posting_queue`. `PremiereSection.tsx` auf der
Landing spielt stumm-autoplay mit Haus-Credit und Shop-Link und zählt
`premiere_views` / `shop_clicks` atomar über `bump_video_metric`. Designer sehen
ihre Videothek unter `/studio/videothek`.

## Signaturen, Lernschleife, Editionen

`house_signatures` (`designer_id`, `name`, `recipe` jsonb: Licht, Palette,
Kamerafahrt, Schnittrhythmus, Typo, Musik-Tempo). „Der Regisseur"
(`generate-signatures`, ruft Claude direkt) destilliert je Haus 3–5 Signaturen aus
`brand_dna` + `fashion_ontology` — on demand beim ersten Öffnen von
`/studio/kampagnen/neu`, plus Admin-Massenlauf unter `/admin/jarvis`.

Kontingent aus `ai_config.plans` → `plaene.*.limits.signature_previews`: Haus 1,
Atelier 3, Maison unbegrenzt plus eine Wunsch-Signatur.

Der Client-Renderer (`src/features/campaign/renderer.ts`, `scenes.ts`) und
`generate-broll` lesen das Rezept. Bei gesetzter Signatur wechselt
`generate-broll` auf `ai_config.video_provider.model_premium`. Jedes Video
schreibt sein `video_dna` (signatur, hook_typ, schnittrhythmus, palette, laenge_s,
modelltyp).

**Editionen** sind häuserübergreifende Kampagnen (`editions` +
`edition_participants`). Admin wählt Thema und Häuser unter `/admin/editionen`,
„Produzieren starten" erzeugt je Haus einen Clip in dessen Signatur
(`generate-edition-video`, source `edition`). Das Ergebnis landet **nicht** direkt
in `video_assets`: jedes Haus bekommt unter `/studio/kampagnen` eine
Freigabe-Karte (Umsetzen / Verwerfen). Erst „Umsetzen" schreibt den Eintrag.
**Ohne Freigabe wird nie etwas veröffentlicht.**

## PAWN Jarvis

Interne KI-Instanz für Daouda, nicht kundenseitig. Edge Function `pawn-jarvis`
(admin-only) mit drei Werkzeugen: `web_search` (nativ), `query_pawn` (liest
Kennzahlen), `pawn_action` (ruft `pawn-actions` mit der echten Admin-Sitzung — nur
dessen bestehende Whitelist, nie neue Aktionen).

Modi: `morgenbericht`, `wochenbericht`, `recherche`, `befehl`, `kampagnen_regie`.
Der wöchentliche `kampagnen_regie`-Lauf liest Première-Views und Shop-Klicks aus
`video_assets.performance`, destilliert `designers.video_taste_weights`, schreibt
einen Bericht (`jarvis_reports`, kind `regie`) und legt gelegentlich eine Edition
als **Entwurf** an — Zone Gelb, nie Auto-Launch.

Jeder Lauf schreibt eine Zeile in `jarvis_runs`. System-Prompt aus
`ai_config.persona_jarvis`. Fehler landen nie als 500, immer als 200 mit
Klartext-Meldung. Der Herzschlag meldet unter anderem: ein veröffentlichtes Haus
mit Produkten, das seit über 3 Tagen kein `stripe_charges_enabled` hat, kann nicht
verkaufen.

## Die Karte des Codes

| Wo | Was |
|---|---|
| `src/pages/Index.tsx` | Landing: Hero, Welten, Grid, Cover Story, Atelier-Feature, Pick-your-Style, Morph-Szene |
| `src/components/palace/` | Design-System: `Editable`, `EditorialImage`, `WorldPage`/`WorldHero`, `PawnWordmark`, `PalaceHeader` |
| `src/pages/studio/` | Designer-Studio: Bühne mit „Nächster Zug", Kollektion, Kampagnen-Funnel, Bestellungen mit Versand-Kette, Plan, Retrospektive |
| `src/pages/admin/` | Admin-Cockpit: Overview, KI/Denklogik, Trends, Posting, Zahlungen, Aktionen-Log, Archiv, Editionen |
| `src/features/campaign/renderer.ts` | Browser-Video-Renderer (Canvas + MediaRecorder). Reel-Safe-Zones oben 14 %, unten 20 % |
| `src/lib/i18n.tsx` | Wörterbücher `de` und `en`. `en` ist über `Record<keyof typeof de, string>` an `de` gefesselt |
| `src/lib/planGate.ts` | Die einzige Leseklinke für Plangrenzen im Browser |
| `tools/pruefstand/` | Browser-Messung, vier Breiten, schreibt Zahlen und Aufnahmen |

**Wichtige Edge Functions:** `create-checkout`, `stripe-connect`,
`stripe-webhook`, `generate-broll`, `generate-tryon`, `generate-product-shot`,
`poll-broll`, `generate-signatures`, `generate-edition-video`, `pawn-chat`,
`studio-ai`, `pawn-actions`, `compute-trends`, `pawn-jarvis`.

**Datenmodell-Kern:** `designers` (house_number, plan, brand_dna,
video_taste_weights, stripe_account_id / stripe_charges_enabled /
stripe_details_submitted, media_rights_granted_at) · `products` (product_dna
jsonb, designer_note, Maße) · `orders` (application_fee_cents,
destination_account) · `campaigns` · `posting_queue` · `generation_requests` ·
`product_shot_requests` · `video_assets` · `house_signatures` · `editions` ·
`edition_participants` · `ai_budget_ledger` · `fashion_ontology` (lernend,
`learned`-Flag) · `user_memory` · `ai_actions_log` · `acquisition_leads` ·
`jarvis_runs` · `jarvis_reports` · `site_content` · `ai_config`.

## Zwei Dinge, die man immer wieder falsch macht

1. **Texte und Bilder kommen aus `site_content`** (Key-Value) über `useContentValue`
   aus `src/components/palace/Editable.tsx`. Neue statische Texte möglichst dort
   anbinden — dann kann Daouda sie ohne Code ändern.
2. **Die KI-Konfiguration steht in `ai_config`** (personas, directives, plans,
   video_provider, tryon_provider, business_profile). Im Code nur **lesen**, nie
   Werte hart verdrahten.
