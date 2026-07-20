# CLAUDE.md — PAWN Projekt-Briefing

Du arbeitest am Repo **pawn-prototype**: PAWN (pawn.vision) — kuratierter Marktplatz + KI-Betriebssystem für unabhängige Designer (Mode · Interior · Kunst). Gründer: Daouda (kein Entwickler — erkläre Änderungen in einfachem Deutsch, keine Fachbegriffe ohne Erklärung).

## Stack & Deployment (WICHTIG)
- Vite + React + TypeScript + Tailwind; Backend: Lovable Cloud (managed Supabase, Projekt rnakubexbqfgfciynqpt).
- **Frontend:** Push auf `main` → Lovable synct & deployt automatisch (Vercel spiegelt auf pawn.vision). Frontend-Arbeit ist also „gratis" über Git.
- **Edge Functions (`supabase/functions/*`):** Code darfst du ändern, aber **Deploy passiert NUR über den Lovable-Agenten** (kostet Credits). Nach Function-Änderungen: Daouda sagen, dass ein Lovable-Deploy nötig ist. Niemals eigene Deploy-Versuche.
- **Secrets** (STRIPE_SECRET_KEY, FAL_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, STRIPE_WEBHOOK_SECRET): existieren nur in Lovable/Supabase. Nie hardcoden, nie in .env committen, nie erfragen.

## Design-Gesetze (nicht verhandelbar)
- **Nur #000 und #FFF.** Keine Grautöne als Flächen, keine Farben — EINZIGE Ausnahme: Welt-Kopfbilder (world hero) via `color`-Prop auf `EditorialImage`.
- **border-radius: 0 überall.** Harte Kanten, 1.5px-Linien, harte Offset-Schatten (`6px 6px 0 #000`).
- Serifen: **Playfair Display** (600, italic für Akzente); UI: Inter. Kein font-weight 300.
- Hover = Invertierung (schwarz↔weiß), nie Opacity.
- Wordmark: `PawnWordmark`-Komponente (P + Bauern-SVG + WN). Nicht nachbauen.
- Leere Zustände: ehrlich und poetisch („Die ersten Häuser ziehen ein."), NIE Fake-Daten.

## Harte Regeln
1. **Keine Mock-/Seed-Daten wieder einführen.** `src/core/seed/*` hat leere Arrays — so bleibt es. Echte Markennamen (Rick Owens etc.) sind rechtlich verboten.
2. **RLS-Policies, Trigger, Migrationen in `supabase/`**: nur nach explizitem Auftrag anfassen.
3. **Rechtstexte** (`/agb`, `/impressum`, `/datenschutz`, `/widerruf`): Inhalte nur auf ausdrücklichen Wunsch ändern.
4. **`vercel.json` (SPA-Rewrite) nicht löschen.**
5. Auth läuft über `supabase.auth` direkt (signInWithOAuth mit `redirectTo: window.location.origin`) — NIE Lovable-interne `/~oauth`-Pfade verwenden.
6. Texte/Bilder der Site kommen aus `site_content` (Key-Value) via `useContentValue` aus `src/components/palace/Editable.tsx` — neue statische Texte möglichst darüber anbinden, damit sie ohne Code änderbar sind.
7. Konfiguration der KI liegt in DB-Tabelle `ai_config` (personas, directives, plan_limits, video_provider, tryon_provider, plan_prices, business_profile) — im Code nur lesen, nie Werte hart verdrahten.

## Karte des Codes
- `src/pages/Index.tsx` — Landing (Hero, Welten, Grid, Cover Story, Atelier-Feature, Pick-your-Style, Morph-Szene)
- `src/components/palace/` — Design-System (Editable, EditorialImage, WorldPage/WorldHero, PawnWordmark …)
- `src/pages/studio/` — Designer-Studio (Bühne mit „Nächster Zug", Kollektion, Kampagnen-Funnel `StudioCampaignNew.tsx`, Bestellungen mit Versand-Kette, Plan, Retrospektive)
- `src/pages/admin/` — Admin-Cockpit (Overview mit Nächster-Zug, KI/Denklogik, Trends, Posting, Zahlungen, Aktionen-Log)
- `src/features/campaign/renderer.ts` — Browser-Video-Renderer (Canvas + MediaRecorder; Szenen: Hook-Typo, Ken-Burns, Split, Parallax; Reel-Safe-Zones oben 14%/unten 20%; adaptive Szenenzahl nach Fotoanzahl)
- Wichtige Edge Functions: `create-checkout` (Stripe, KEIN automatic_payment_methods-Parameter!), `stripe-webhook`, `generate-broll` (fal i2v), `generate-tryon` (Kolors Try-On, Model-Pool), `generate-product-shot`, `pawn-chat`, `studio-ai`, `pawn-actions` (Aktionsschicht mit Undo), `compute-trends`
- Datenmodell-Kern: designers (house_number, plan haus/atelier/maison, brand_dna), products (product_dna jsonb, designer_note, Maße), campaigns, posting_queue, generation_requests, product_shot_requests, fashion_ontology (lernend, `learned`-Flag), user_memory, ai_actions_log, acquisition_leads (Akquise-Pipeline), site_content, ai_config

## Arbeitsweise
- Kleine, fokussierte Commits mit deutschen Messages („Fix: …", „Feature: …").
- Vor jedem Commit: `npm run build` (bzw. Typecheck) muss grün sein.
- Mobile-first prüfen: iPad + 390px. Instagram-Safe-Zones bei allem, was Video/Reel betrifft.
- Bei Unsicherheit über Produktentscheidungen: Frage stellen statt raten. Daouda entscheidet, du baust.
- Aktuelle Prioritäten stehen ggf. in `docs/TODO.md` — falls vorhanden, zuerst lesen.

## Kontext
Budget ist knapp: Lovable-Credits sind teuer und nur für Edge-Function-Deploys reserviert. Deine Frontend-Arbeit über Git ist der günstige Kanal — nutze ihn präzise. PAWN ist live und hat echte Stripe-Zahlungen: Vorsicht vor Regressionen im Checkout- und Auth-Flow.
