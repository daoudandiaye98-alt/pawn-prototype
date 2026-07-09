# Video-Qualität auf KI-Niveau

Zwei Hauptebenen + zwei Nachzügler. Ergebnis: Kampagnenvideos fühlen sich wie echte Editorial-Reels an, nicht wie Diashows. Wer will (und kann), rendert echte KI-Bewegung via fal.ai in PAWN-Regie.

---

## 0. Nachzügler

### 0a. Level-Up-Vollbild-Moment
- Neuer Provider `LevelUpOverlay` in `src/features/studio/LevelUpOverlay.tsx`. Hört auf Änderungen des `designer_level` RPC (Poll bei Login + nach mutierenden Aktionen). Speichert `last_seen_level` in `localStorage` pro user. Bei Upgrade → Vollbild-Overlay (schwarzer Screen, Glyph groß animiert, „Aus dem Bauern wird der Springer." 2 s, sanfter Fade-Out zurück).
- Trigger auch aus `useDesignerLevel` hook heraus.
- Zusätzlich Notification-Insert (`type: 'designer.level_up'`, Titel/Body mit neuem Level, link `/studio`).
- Overlay in `StudioShell` einhängen.

### 0b. Pinterest-Integration Stub
- `ai_integrations` bekommt einen Seed-Eintrag `kind='pinterest'` (falls noch nicht vorhanden), Config-Felder `{ board_id: '', api_token: '' }`, `enabled=false`.
- `/admin/ki` → Integrationen: Karte „Pinterest" mit „bald"-Badge, Felder disabled, kurzer Text „Board-Direktposts kommen im nächsten Zyklus."

---

## 1. Stufe 1 aufwerten (Renderer-Regie)

Datei `src/features/campaign/renderer.ts` bekommt eine echte Szenen-Bibliothek statt nur Ken-Burns.

Neue Szenentypen (jeweils reine Draw-Funktion, deterministisch aus Seed + Assets):

| Szene | Kurz |
|---|---|
| `parallax-duo` | Foto 70% Höhe, versetzt darüber weiße Typo-Karte (1.5px Rahmen, harter Schatten) — Karte driftet gegenläufig zum Foto |
| `split-frame` | Zwei Fotos nebeneinander, gegenläufiger Slow-Drift, 1.5px-Trennlinie |
| `kinetic-typo` | Hook-Zeile Wort für Wort in Playfair, Hintergrund kippt schwarz↔weiß pro Wortgruppe |
| `mask-reveal` | Foto wird von wachsendem schwarzen Balken freigegeben (Wipe) |
| `detail-punch` | Schneller Crop-Zoom auf Bildausschnitt + 2-Frame Weißblitz am Ende |

Storyboard-Wahl:
- Tempo `ruhig` → bevorzugt `parallax-duo`, `mask-reveal`, längere Shots (~3.2 s).
- Tempo `spannungsvoll` → bevorzugt `split-frame`, `kinetic-typo`, `detail-punch`, kurze Shots (~1.8 s).
- Sequenz aus deterministischem PRNG-Seed (mulberry32) — bei „Neu produzieren" neuer Seed → andere Sequenz. Seed als Prop exposen und im UI-Button anzeigen.

Übergänge zwischen Szenen: `hard-cut`, `white-flash` (2 Frames), `wipe-left`.

Alle Bewegungen mit `ease()` bzw. `easeInOutCubic` — nie linear.

Format-Wahl: neuer Input `format: '9:16' | '1:1'`. Canvas-Dimensionen und Text-Layout parametrisiert (1080×1920 vs. 1080×1080). Funnel Schritt 3 zeigt Toggle.

### Renderer-Refactor (kurz)
- Trenne `layout` (Dimensionen, Padding) von `scenes`. `Scene` bekommt `type`, `render(ctx, tProgress, layout)`.
- `buildScenes(input, imgs, prng)` liefert die Sequenz.
- `renderCampaign` bleibt API-kompatibel, neuer optionaler `format`- und `seed`-Param.

### Funnel-Update
`StudioCampaignNew.tsx` — Schritt 3: Format-Toggle (Reel/Feed), „Neu würfeln"-Button (neuer Seed), Tempo bleibt.

---

## 2. Stufe 2 — Kinematischer Modus (fal.ai)

### Schema-Erweiterung
Migration:
- `ai_config`-Zeilen: `video_provider` (default `fal-ai/kling-video/v2.1/standard/image-to-video`), `video_motion_prompt_template`, `video_seconds` (default 5).
- `generation_requests` schon vorhanden — sicherstellen: `tier ('accent'|'hero')`, `status ('queued'|'processing'|'completed'|'failed')`, `provider_request_id`, `source_image_url`, `result_url`, `cost_units`, `error_message`.
- `plan_limits` bekommt `accent_cost_units` (default 2), `unlimited` (bool, default false für Admin/maison-Override).

### Edge Function `generate-broll`
Vollständige Implementierung:
1. Auth: user muss designer sein, plan in `('atelier','maison')` ODER admin.
2. Input: `{ campaign_id, image_urls: string[], motion_prompt?: string }`.
3. Prompt-Bau: Template aus `ai_config` (Fallback-Konstante) + Brand-DNA + Designer-Prompt → finaler motion-Prompt.
4. Für jede image_url: POST an `https://queue.fal.run/{model}` mit `Authorization: Key ${FAL_KEY}`, Body `{ image_url, prompt, duration: 5 }`. Response liefert `request_id` + `status_url`.
5. `generation_requests` insert mit `status='queued'`, `provider_request_id`, `source_image_url`, `cost_units = accent_cost_units`.
6. Antwort an Client: Liste `{ request_id, source_image_url }`.

### Edge Function `poll-broll` (neu)
- Input: `{ request_ids: uuid[] }`.
- Für jede: GET fal `status_url`. Wenn `COMPLETED` → response holen, `video_url` extrahieren, `fetch(video_url)` → Upload nach `campaign-assets/{designer_id}/{request_id}.mp4` (same-origin!) → `result_url` (signed URL / storage-Pfad) speichern, Status `completed`. Bei `FAILED`/Timeout > 5 min → Status `failed` + `error_message`. Notification bei allen completed.
- Client polled alle 4 s bis alle terminal.

### Kein FAL_KEY
- Edge Function prüft `Deno.env.get('FAL_KEY')`. Fehlt → 402 + Klartext.
- Funnel: Option sichtbar, disabled, Tooltip „Wird vom Haus aktiviert".
- `/admin/ki` → Integrationen: Zeile „FAL", Status `nicht eingerichtet` / `aktiv`, Kosten-Summe aus `generation_requests` (sum `cost_units` letzte 30 Tage), Anleitung mit Link zu fal.ai.

### Fehlerpfad
- Wenn eine Clip-Generierung fehlschlägt oder alle in Timeout: Funnel fällt elegant auf Stufe 1 zurück mit Meldung „Die Kamera hatte einen schlechten Tag — hier ist die Editorial-Fassung." und rendert klassisch mit den Fotos.

### Renderer im kinematischen Modus
- Neuer Input-Zweig: `clips: { url: string; sourceImage: string }[]` statt `imageUrls`.
- Szenen laden `<video>` (preload, muted, playsinline), `video.currentTime` kontrolliert per rAF, `ctx.drawImage(video, ...)` mit denselben Ken-Burns/Overlay-Transformationen — Typo-Overlays, Intro/Outro und Cuts bleiben identisch, nur die Foto-Layer ist jetzt Video.
- iPad Safari: `MediaRecorder` prüfen (Fallback bereits vorhanden), `video.captureStream` nicht nötig (wir zeichnen Frames selbst).

---

## 3. Quota-Kopplung

- `useCampaignQuota` liest `plan_limits.accent_cost_units`. Kinematischer Modus zählt N (default 2) Units pro Kampagne.
- Funnel-Anzeige: „verbraucht 2 deiner 10 Kampagnen".
- Wenn `plan_limits.unlimited = true` (admin/maison optional) → kein Abzug.

---

## 4. Qualität

- Typecheck grün.
- Playwright: als test-designer Kampagne mit neuen Szenen (Stufe 1) erzeugen, URL/Screenshot nachweisen.
- `generate-broll` ohne Key aufrufen → sauberer 402-Response.
- iPad-Safari-Kompat: MediaRecorder-Format-Fallback verifizieren (schon vorhanden).

---

## Technische Änderungen (Kurzliste)

**Neu:**
- `src/features/studio/LevelUpOverlay.tsx`
- `src/features/campaign/scenes.ts` (Szenen-Bibliothek)
- `src/features/campaign/prng.ts` (deterministischer Seed)
- `supabase/functions/poll-broll/index.ts`
- Migration: `ai_config` seeds, `plan_limits` erweitern, `generation_requests` sichern, `designer.level_up` notification-type erlauben.

**Geändert:**
- `src/features/campaign/renderer.ts` (Refactor + Video-Clip-Modus + Format)
- `src/features/campaign/quota.ts` (accent_cost_units, unlimited)
- `src/pages/studio/StudioCampaignNew.tsx` (Format-Toggle, Seed-Würfeln, Kinematischer Modus mit Polling, Fehler-Fallback)
- `src/pages/admin/AdminKI.tsx` (FAL-Integrationszeile, Pinterest-Stub, Kostenanzeige)
- `src/components/pawn/StudioShell.tsx` (LevelUpOverlay mounten)
- `supabase/functions/generate-broll/index.ts` (echte fal-Anbindung)

Ausführung startet direkt nach Bestätigung.
