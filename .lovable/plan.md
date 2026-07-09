
# Finale Zug 2 von 2 — vollständiger Umsetzungsplan

Großer Umfang. Ich zerlege in fünf abgeschlossene Blöcke, jeder mit klarem Nachweis.

## 1. User-X überall verdrahten
- `/admin/nachrichten` (`AdminMessages.tsx`): Thread-Liste + Detail zeigen "User 3 → Designer 1" (Klarname als kleine Zweitzeile nur Admin).
- `/admin/zahlungen` (`AdminPayments.tsx`): Bestellliste "User 3 an Designer 1 · PAWN 7% (€X)".
- `/admin` Nutzer-/Designerlisten (AdminDesigners, AdminApplications, AdminOverview-Tabellen): Handle-Spalte.
- Studio-Nachrichten (`StudioMessages.tsx`): Kunde als "Vorname · User 3".
- Kunden-Threads (Account/Threads): Designer als "Brand · Designer 1".
- Alle neuen `domain_events`-Payloads: `internal_handle` mitliefern (helper util).

## 2. Kunden-KI auf Berater-Niveau
- **Bild-Upload im Chat** (`ChatDrawer.tsx`):
  - Storage-Bucket `taste-uploads` (privat, RLS owner + service_role).
  - Upload-Button (Kamera/Datei), Bild-Bubble im Chat.
  - `pawn-chat` erweitert: mit `OPENAI_API_KEY` → Vision-Call (gpt-4o-mini), gibt Ontologie-Terme zurück, speichert `taste_signal {source:'image', terms}`.
  - Ohne Key: Bild speichern, freundliche Chip-Auswahl "[Farben] [Schnitt] [Stimmung]" die Terme setzt.
- **Pinterest-Feld**: Chat-Menü "Pinterest verbinden" → Feld für Board-Link → gespeichert in `user_memory.preferences.pinterest_board` + `taste_signal source:'pinterest'`. Ehrliche Antwort: "Ich schaue mir dein Board an, sobald der Parser freigeschaltet ist."
- **Farb-Kompetenz**:
  - `persona_customer`-Prompt in `ai_config` erweitern um Color-Seasons-Block (Frühling/Sommer/Herbst/Winter, warm/kühl, Palette pro Unterton).
  - `fashion_ontology`: ~16 Farbtyp-Terme seeden (kind='color', mit Synonymen: warmes ecru, kühles grau, sattes bordeaux, …).
  - Fallback-Gesprächsbaum: Route "Gold- oder Silberschmuck?" → warm/kühl → Palettenempfehlung + Produkt-Chips.

## 3. Produkt-DNA-Moleküle
- **Migration**: `products.product_dna jsonb` `{materials[], silhouette[], colors[], mood[]}`.
- **Produkt-Editor** (`StudioProducts.tsx` bzw. Produkt-Modal): neuer Pflicht-Schritt "DNA des Stücks" mit vier Chip-Gruppen aus `fashion_ontology` (Material mehrfach, Silhouette 1-2, Farben 1-3, Stimmung 1-2).
- Speichert automatisch `tags` (union) + triggert `recompute_brand_dna`.
- **Matching**: `usePersonalization` gewichtet je kind: Stimmung ×2, Silhouette ×1.5, Material/Farbe ×1.
- **Züge-Liste**: Wenn Designer Produkte ohne `product_dna` hat → Zug "Vervollständige die DNA deiner Stücke".

## 4. Rechtstexte v1 (klar gelabelt "Vorläufige Fassung — anwaltliche Prüfung ausstehend")
- Business-Daten aus `ai_config.business_profile` (Daouda Ndiaye · PAWN, pawnstudio.co@gmail.com; Adresse Builder-editierbar).
- `/impressum`: echte Daten.
- `/agb`: voller Marktplatz-AGB-Text (Vertragsschluss Kunde↔Designer, PAWN Vermittler, Stripe-Payments, 7% Provision, Pläne monatlich kündbar, Anfertigungen, Gewährleistung beim Designer).
- `/widerruf`: neuer Route, 14 Tage, Ausnahme individuelle Anfertigungen.
- `/datenschutz`: final durchziehen (Signale, Sessions, user_memory, Bild-Uploads, Cookies, Auskunft/Löschung).
- `contract_versions`: Designer-Vertrag v2 seeden (Leistungen PAWN, 7%, monatliche Auszahlung, Bildrechte widerruflich, Laufzeit/Kündigung, Datenverarbeitung).
- Studio-Hinweis "Aktualisierter Vertrag — bitte zustimmen" mit consents-Flow.

## 5. Pläne mit klarem Mehrwert + Premium-KI
- `/studio/plan`: neue Nutzen-Zeilen:
  - **HAUS (0€)**: 2 Kampagnen/M · Editorial-Regie · PAWN-KI Standard · 7% bleiben immer 7%.
  - **ATELIER (19€/M)**: 10 Videos · ✦ Kinematischer Modus · PAWN+ Denkstufe · wöchentlicher Trend-Report im Spiegel.
  - **MAISON (79€/M)**: 30 Videos · alle Stufen + Priorität in Queue · PAWN+ Max · persönlicher Einrichtungs-Check.
- **Modellwahl**: `ai_config.model_tiers = {standard:{model:'gpt-4o-mini'}, plus:{model:'gpt-4o'}, max:{model:'gpt-4o'}}`. `studio-ai` + `pawn-chat` mappen `designers.plan` → tier (haus→standard, atelier→plus, maison→max). Copilot-Badge "PAWN+ aktiv" bei bezahlten Plänen.
- **Posting-Queue-Priorität**: `enqueue_campaign_post` sortiert `maison > atelier > haus`.
- **Wochenspiegel**: für atelier/maison automatisch mit Trend-Block.

## Nachweis
- Typecheck grün, mobile-Stichprobe.
- Screenshots: `/agb` (Header + Provisionsklausel), `/studio/plan` (drei Karten mit Nutzen-Zeilen).
- Ein Produkt mit `product_dna` in DB (SELECT-Nachweis).
- Ein Chat-Bildupload → Datensatz in `taste-uploads` + `taste_signal` in `domain_events`.

## Reihenfolge der Ausführung
1. Migrationen (product_dna, contract_versions v2, ontology-color-terme, storage-bucket, ai_config keys).
2. Backend-Functions (pawn-chat vision, studio-ai model-tier, enqueue-priority).
3. UI: Rechtstexte, Plan-Seite, Produkt-DNA-Editor, ChatDrawer-Upload, User-X-Verdrahtung.
4. E2E-Nachweis mit Screenshots.

Umfang ist erheblich (~15-20 Dateien + 3 Migrationen). Ich arbeite die Blöcke sequentiell ab und melde Zwischenschritte.
