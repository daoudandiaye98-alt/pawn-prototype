# Zug 2 — Kampagnen-Studio

Grosser Zug. Ich baue ihn in einem Durchgang, aber in klaren Blöcken. Wenn du zustimmst, geht's los.

## 1. Datenbank (eine Migration)
- `designers.plan` enum `haus|atelier|maison` (default `haus`).
- `posting_queue`: campaign_id FK, channel enum (`pawn_instagram|pawn_tiktok|pawn_youtube`), scheduled_at, status (`queued|posted|failed`), posted_url, posted_at. RLS: Designer liest eigene über Join, Admin alles. Grants inkl. service_role.
- `generation_requests`: campaign_id, tier (`accent|full`), provider, status, cost_estimate, result_url. RLS Designer read own, Admin all.
- Storage-Bucket `campaign-assets` (public read) via Tool.
- Seed `ai_config` Keys: `plan_limits`, `plan_prices`.

## 2. Video-Renderer (client, kein Server)
`src/features/campaign/renderer.ts`
- Canvas 1080×1920, 30fps, MediaRecorder (`video/mp4` → Fallback `webm;codecs=vp9` → `webm`).
- Szenen: Intro 2s (Brandname Playfair + "Haus № X") → 2–4 Fotos je 2.5–3s (grayscale+contrast, Ken-Burns alternierend, 2-Frame-Weißblitz Cut, Typo-Overlay) → Outro 2.5s (Wordmark, "Haus № X · pawn").
- Tempo `ruhig|spannungsvoll` steuert Shot-Dauer + Zoom-Delta.
- Kein Audio (UI-Hinweis: Musik im Kanal hinzufügen).
- Progress-Callback + Live-Canvas-Preview.

## 3. Funnel `/studio/kampagnen/neu`
4 Schritte, plus Schritt 0 Erklärung:
- Schritt 0: 4 Akte, image_usage-Consent-Check (Inline-Zustimmung sonst), Kontingent-Zeile.
- Schritt 1: Eigenes Produkt wählen (Karten) oder 2–4 Fotos hochladen (Drag&Drop → `campaign-assets`).
- Schritt 2: Prompt-Feld + 3 DNA-Preset-Chips. `studio-ai` liefert Hook/Caption/Hashtags (nutzt Brand-DNA + Trend-Terme). Editierbar. Tempo-Auswahl.
- Schritt 3: Renderer läuft sichtbar, danach `<video>`-Preview, "Neu produzieren" (Variation) / "Zur Freigabe". Upload → `campaigns` row (kind `video`, status `proposed`, content-JSON).
- Schritt 4: bestehende Detailkarte auf `/studio/kampagnen` erweitert (Player, Freigeben/Ändern, nach Freigabe Download + Musik-Hinweis).

Prominenter "Neue Kampagne"-CTA im Studio-Dashboard und auf `/studio/kampagnen`.

## 4. Posting-Queue
- Bei Kampagnen-Freigabe (`status=approved`) via Trigger: Eintrag `posting_queue` für `pawn_instagram`, `scheduled_at` = nächster freier Slot (max 3/Tag global, FIFO).
- `/admin/posting` (Route + AdminShell-Nav): Liste mit Video-Preview + Status + "Als gepostet markieren" (URL-Feld) + Doku-Kasten der nötigen Secrets. Ehrlich gelabelt.
- Edge Function `post-to-social` als Dispatcher-Stub (Provider-Interface, loggt `integration.dispatched`).
- Designer-Ansicht: Status-Zeile pro Kampagne ("In Warteschlange · voraussichtlich Do" bzw. "Veröffentlicht → Link").

## 5. Pläne + Kontingente
- Zählung: `campaigns` kind=video im Kalendermonat.
- Studio-Dashboard + Funnel Schritt 0: Zeile "Kampagnen diesen Monat: X von Y".
- Bei Limit: Upgrade-Karte in Schritt 3, Rendering blockiert.
- `/studio/plan`: 3 Karten Palace-Stil (Haus / Atelier 19€ / Maison 79€). Upgrade → `create-checkout` (subscription-mode) mit `plan_prices` aus ai_config. Fehlt Stripe-Setup: Karte "Bald buchbar — schreib uns" → erzeugt Message-Thread.
- `stripe-webhook` erweitert: subscription-Events → `designers.plan` setzen + Notification + `domain_events` Event.

## 6. Stufe 2/3 vorbereiten
- Edge Function `generate-broll`: Provider-Interface, sauberer Fehler wenn `KLING_API_KEY`/`RUNWAY_API_KEY` fehlen; TODO-Block für Call.
- Funnel Schritt 2: für atelier/maison ausgegraute Option "✦ Generativer Akzent-Shot (bald)".
- `/admin/ki` bekommt Status-Zeile Video-Provider.

## 7. QA
- image_usage-Consent-Check vor Schritt 1.
- MediaRecorder-Format-Fallback getestet.
- Playwright-Testlauf als `test-designer@pawn.test`: Funnel → Video → Freigabe → Queue-Sichtung → Screenshot.
- Typecheck.

## Reihenfolge der Ausführung
1) Migration + Bucket
2) Renderer-Modul (pure TS, unit-testbar durch Aufruf)
3) Funnel-Seiten + Studio/Admin-Integration
4) Queue-Trigger + `/admin/posting` + Dispatcher-Stub
5) Plan-Seite + Stripe-Webhook-Erweiterung + Kontingent-Guard
6) generate-broll-Stub + AdminKI-Statusreihe
7) Playwright-Selbsttest + Screenshots

Umfang groß — ich schreibe fokussiert und ohne Dekoration. Bestätige mit "Los", dann startet die Migration und der Rest folgt in schneller Abfolge.
