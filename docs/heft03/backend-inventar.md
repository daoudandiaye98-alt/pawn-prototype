# pawn.vision — Backend-Inventar für das öffentliche Kunden-Frontend

Stand: Auszug des Repos unter `work/pawn-prototype/` (Supabase-Projekt `rnakubexbqfgfciynqpt`, Lovable Cloud).
Quelle für Spaltentypen: `src/integrations/supabase/types.ts` (generiert). Quelle für RLS: nur die 20 Migrationen im Auszug (`supabase/migrations/*.sql`) — die Basistabellen `products`, `orders`, `wishlists`, `customer_measurements`, `message_threads`, `messages`, `site_content`, `i18n_overrides`, `curated_collections`, `collection_items`, `pawn_signals`, `ai_sessions`, `ai_config` werden in **keiner** Migration des Auszugs angelegt. Für diese Tabellen steht unten „RLS nicht in Auszug"; die Aussage „anon liest" ist dann aus dem Frontend-Verhalten abgeleitet (Frontend ruft sie ausgeloggt auf), nicht aus einer Policy belegt.

**Wichtige Unschärfe:** `types.ts` ist älter als die letzten Migrationen. Die Spalte `designers.kauf_freigeschaltet` (Migration `20260923090000`), die Tabelle `first_move_sessions` und die RPC `first_move_publish()` (Migration `20260921090000`) fehlen in `types.ts`. `src/heft/verzeichnis.tsx` kommentiert ausdrücklich, dass `kauf_freigeschaltet` in der Live-DB „nicht existiert" und liest stattdessen `verkaufsbereit`. Ob die 09/2026-Migrationen live sind, ist aus dem Auszug nicht entscheidbar.

Alle Frontend-Zugriffe laufen über den einen Client `@/integrations/supabase/client` (anon key + Session-JWT). Es gibt keine eigene API-Schicht; RLS ist die einzige Grenze.

---

## 1. Tabellen & Spalten (öffentliches Frontend)

Notation: `spalte: TS-Typ` aus `types.ts` Row. Enums siehe Abschnitt 1.30.

### 1.1 `products`
Vollständige Row (types.ts Z. 3056 ff.):
`allow_custom_requests: boolean` · `banner_media_asset_id: string|null` · `care_instructions: string|null` · `care_symbols: string[]` · `compare_at_price: number|null` · `cover_shown_at: string|null` · `created_at: string` · `description: string|null` · `designer_id: string` · `designer_note: string|null` · `edition_info: string|null` · `gpsr_eu_responsible: string|null` · `gpsr_manufacturer_address: string|null` · `gpsr_manufacturer_name: string|null` · `gpsr_safety_warning: string|null` · `height_cm: number|null` · `id: string` · `image_url: string|null` · `inventory_mode: "stock"|"made_to_order"` · `lead_time_days: number|null` · `length_cm: number|null` · `lining_hardware: string|null` · `made_in: string|null` · `material_composition: Json` · `measurements: Json` · `name: string` · `price: number` (Euro, nicht Cent) · `product_dna: Json` · `size_variants: Json` · `sku: string|null` · `slug: string` · `status: "draft"|"published"|"archived"` · `stock_quantity: number` · `sustainability_note: string|null` · `tags: string[]` · `updated_at: string` · `variants: Json` · `vat_rate: number|null` · `view_count: number` · `weight_grams: number|null` · `width_cm: number|null` · `world: "Mode"|"Interior"|"Kunst"`.

JSON-Formen (aus `src/features/studio/productDetails.ts` und `src/lib/weltFelder.ts`):
- `size_variants`: `SizeVariant[]` = `{ size: string; stock: number; surcharge: number; sku: string|null }[]`.
- `measurements`: `{ rows: string[]; values: Record<row, Record<size, string>> }` (cm als Text).
- `material_composition`: `{ material: string; percent: number }[]`.
- `product_dna`: gemischt. Mode-Arrays `materials`, `silhouette`, `colors`, `mood` (string[]) **und** Welt-Stringfelder je `WELT_FELDER`: Mode `groesse, passform, material, farbe, pflege`; Interior `masse, gewicht, material, oberflaeche, farbe, fertigung, lieferzeit, montage, pflege, belastbarkeit`; Kunst `technik, medium, masse, jahr, auflage, signatur, rahmung, traeger, zustand`. Zusätzlich `kind` (Angebotstyp: Mode `verkauf|auf_bestellung`; Interior `verkauf|auf_bestellung|massanfertigung|materialmuster`; Kunst `original|print|auftragsarbeit|live_portrait`). `massanfertigung`, `auftragsarbeit`, `live_portrait` tragen `ohneKauf` → kein Warenkorb, nur Anfrage (`src/heft/werk.tsx: kannInDenKorb`).

Es gibt **keine** Bildergalerie-Spalte/-Tabelle am Produkt: nur `image_url` (ein Bild) plus optional `banner_media_asset_id` → `media_assets`. Weitere Bilder existieren nur indirekt über `media_assets.product_id`.

Nutzer im Frontend:
- `src/lib/publicData.ts: usePublishedProducts` — `id, slug, name, world, price, image_url, designer_id`, Filter `status='published'`, optional `world`, `order created_at desc`, `limit 60`. Regel `istZeigbar()` (Name, Preis>0, Bild gesetzt) ist die einzige Sichtbarkeitsregel — alle Flächen filtern hierdurch.
- `src/heft/verzeichnis.tsx: useVerzeichnisWerke` — `id, slug, name, price, world, image_url, description, product_dna, size_variants, allow_custom_requests, designers(id, slug, brand_name, verkaufsbereit)`, `status='published'`, `limit HOECHSTZAHL`.
- `src/features/products/useDbProduct.ts` — `*, designers(id, slug, brand_name, user_id, house_number, vat_rate, location, verkaufsbereit)` by `slug`, `status='published'`.
- `src/pages/DeineBoutique.tsx` — `id, slug, name, price, world, image_url, created_at, inventory_mode, stock_quantity, product_dna, designers(slug, brand_name)`, `limit 200`.
- `src/features/commerce/hooks.ts: useCartStockLimits` — `slug, inventory_mode, stock_quantity` by `slug in (...)`.
- `src/components/palace/SearchOverlay.tsx` — `slug,name,world,designers(brand_name)` mit `ilike name %q%`, `limit 8`.
- `src/pages/DesignersIndex.tsx` — `view_count` aller published (Summe).
- `src/pages/Ausgabe.tsx`, `src/heft/haeuser.tsx`, `DnaBelege.tsx`, `DnaCover.tsx` — Teil-Selects `id, slug, name, price, image_url, designer_id, created_at`.
- Schreibzugriff aus dem Public-Frontend: nur `view_count` über RPC `bump_product_view` (in `src/heft/*` im Auszug nicht aufgerufen; Migration existiert).

RLS: **nicht in Auszug**. Frontend liest ausgeloggt (Heft-Verzeichnis, Suche) → SELECT für anon auf `status='published'` muss existieren.

### 1.2 `designers` (Häuser)
Row (types.ts Z. 1404 ff.): `id: string` · `user_id: string` · `slug: string` · `brand_name: string` · `house_number: number|null` · `status: string` (Frontend filtert `'active'`) · `published: boolean` · `page_published_at: string|null` · `plan: "haus"|"atelier"|"maison"` · `plan_seit/plan_bis: string|null` · `brand_dna: Json` · `aussenauge: Json` · `onboarding_state: Json` · `story: string|null` (About/Manifest-Text auf Hausseite) · `manifesto: string|null` · `quote: string|null` · `quote_role: string|null` · `collection_title: string|null` · `location: string|null` · `country: string|null` · `website: string|null` · `instagram: string|null` · `tags: string[]|null` (enthält u. a. Welt „Mode"/„Interior"/„Kunst" — so liest pawn-chat die Welt eines Hauses) · Bilder: `hero_image_url`, `avatar_url`, `banner_url`, `portrait_url`, `atelier_image_url`, `atelier_caption` (alle `string|null`) · `is_featured: boolean` · `intern: boolean` · `verkaufsbereit: boolean` · `pawn_guide_enabled: boolean` · `preferred_language: string` · `return_window_days: number` · `revenue_share_pct: number` · `shipping_rates: Json` (`{ inland?, eu?, world?: { flat_cents, free_from_cents } }`) · `vat_rate: number` · Stripe: `stripe_account_id`, `stripe_customer_id`, `stripe_subscription_id` (`string|null`), `stripe_charges_enabled`, `stripe_details_submitted`, `stripe_payouts_enabled` (`boolean`), `stripe_country: string`, `stripe_requirements: Json` · `video_taste_weights: Json` · `weekly_impulse: string|null`, `weekly_impulse_at` · `image_usage_consent`, `image_usage_consent_at`, `media_rights_granted_at` · `dismissed_suggestions: Json` · `hausseite_cover_shown_at: string|null` · `studio_last_seen_at` · `application_id: string|null` · `created_at`, `updated_at`.
Nicht in types.ts, aber Migration `20260923`: `kauf_freigeschaltet boolean` (Trigger aus `ist_kauf_freigeschaltet()` = `ist_verkaufsbereit()` OR Haus gehört Admin).

`brand_dna` JSON-Felder, die das Frontend liest: `worlds: Record<"Mode"|"Interior"|"Kunst", number>`, `signals: string[]`, `archetyp: "galerie"|"editorial"|"atelier"|"archiv"` (`src/features/houseTheme/archetyp.ts`), `rochade.merkmale.{tonalitaet, layout_muster, bildlastig, typo_gefuehl}`. `aussenauge.urteil: string`. `onboarding_state.reife_einschaetzung: string`.

Nutzer: `publicData.ts: usePublicDesigners` (`id, slug, brand_name, location, country, story, quote, quote_role, is_featured, hero_image_url, avatar_url, banner_url, tags, house_number, created_at`, `status='active'`, `limit 60`) · `heft/haeuser.tsx` (`id, slug, brand_name, story, quote, hero_image_url, house_number, page_published_at`, `order house_number`) · `pages/Ausgabe.tsx` (+ `portrait_url`, nur `page_published_at not null`) · `personalization/index.tsx` (`id, slug, brand_name, brand_dna, video_taste_weights`, `status='active' AND published=true`) · `SearchOverlay.tsx` (`slug,brand_name,location`, `ilike brand_name`).

RLS (Migration `20260703183458`): `"designers public read" FOR SELECT USING (published = true)` → anon liest alle Zeilen mit `published=true` (inkl. Stripe-Spalten! Es gibt keine Spaltenmaske). `GRANT SELECT ON designers TO anon, authenticated`. Später hinzugefügte Spalten sind von derselben Policy erfasst.

### 1.3 `designer_page_blocks` (Hausseiten-Bausteine; Migration heißt `hausseite_bausteine`)
Row: `id: string` · `designer_id: string` · `kind: page_block_kind` · `position: number` · `content: Json` · `created_at`, `updated_at`.
`page_block_kind` Enum: `auftakt | editorial_text | zitat | produktreihe | lookbook_streifen | banner_seitlich | banner_vollbreite | ueberlappend` (`ueberlappend` per späterer Migration, nicht im Auszug, aber in types.ts).
`content`-Felder je Kind (aus `HausseiteBlocks.tsx` + `heft/haeuser.tsx`):
- `auftakt`: `media_asset_id`, `media_kind` (`"bild"|"video"`), `abstand?`, `ton?`
- `editorial_text`: `heading`, `text`, `abstand?`
- `zitat`: `quote`, `author`, `abstand?`
- `produktreihe`: `product_ids: string[]`
- `lookbook_streifen`: `media_asset_ids: string[]`, `product_id?`
- `banner_seitlich` / `banner_vollbreite`: `media_asset_id`, `product_id?`, `ton?`
- `ueberlappend`: `media_asset_id_a`, `media_asset_id_b`, `product_id?`
`abstand` ∈ `eng|ruhig|luftig|episch` (überschreibt Theme-Flächenrhythmus).
Nutzer: `heft/haeuser.tsx` (`id, designer_id, kind, position, content`, nur Häuser mit `page_published_at`), `HausseiteBlocks.tsx`.
RLS (Migration `20260729093000`): `"public reads blocks of published pages" FOR SELECT USING (EXISTS designers d WHERE d.id = designer_id AND d.page_published_at IS NOT NULL)`; `GRANT SELECT TO anon`. → anon liest, sobald Hausseite veröffentlicht.

### 1.4 `house_themes`
Row: `id` · `designer_id` · `version: number` · `is_current: boolean` · `name: string|null` · `input_prompt: string|null` · `farbwelt: Json` (`{bg, fg, accent, muted}` Hex) · `typografie: string` (`editorial|zart|archiv|warm`) · `flaechenrhythmus: string` (`eng|ruhig|luftig|episch`) · `kantenhaerte: string` (`hart|weich|rund`) · `bewegungscharakter: string` (`ruhig|gestaffelt|ausdrucksstark`) · `hintergrundtextur: Json` (`{typ: keine|papier|leinen|rauschen, media_asset_id?}`) · `uebergangsart: string` (`fade|iris|schnitt|wisch`) · `zuversicht: string` · `quelle: string` (`dna_destilliert|designer_beschrieben|manuell_verfeinert`) · `guardrail_notes: Json` · `created_at`, `updated_at`.
Typ + CSS-Variablen: `src/features/houseTheme/theme.ts` (`themeCssVars` → `--house-bg/fg/accent/muted/radius/gap-y/reveal-dur/reveal-dist`).
Nutzer: `heft/haeuser.tsx` (`designer_id, farbwelt, typografie, uebergangsart`, `is_current=true`), `DesignersIndex.tsx`, `Ausgabe.tsx` (`farbwelt.accent`).
RLS (Migration `20260731090000`): `"public reads current theme of published pages" FOR SELECT USING (is_current AND EXISTS designers … page_published_at IS NOT NULL)` → anon liest nur aktuelle Version veröffentlichter Häuser. Achtung: `DesignersIndex.tsx` fragt Themes für alle aktiven Häuser — bekommt für unveröffentlichte keine Zeile.

### 1.5 `media_assets` (Mediathek eines Hauses)
Row: `id` · `designer_id` · `kind: "bild"|"video"` · `origin: "upload"|"erzeugt"|"edition"` · `url: string` · `thumb_url: string|null` · `title: string|null` · `note: string|null` · `product_id: string|null` · `campaign_id: string|null` · `video_asset_id: string|null` · `advertises_text: string|null` · `performance: Json` (`{views, shop_clicks}`) · `usages: Json` · `review_status: "privat"|"eingereicht"|"angenommen"|"abgelehnt"` · `review_note` · `rights_granted: boolean` · `shows_synthetic_person: boolean` · `plan_beispiel: string|null` · `created_at`, `updated_at`.
Nutzer: `heft/haeuser.tsx` (`id, url, kind` by id-Liste aus Bausteinen), `src/lib/kiHerkunft.ts: useKiBilder` (`url` wo `kind='bild' AND origin='erzeugt'`, limit 500 — für das KI-Kennzeichen).
RLS (Migration `20260803090000`): `"public reads media of active houses" FOR SELECT TO anon, authenticated USING (EXISTS designers d WHERE d.id = designer_id AND d.status = 'active')` → anon liest **alle** Medien aktiver Häuser (auch `review_status='privat'`).

### 1.6 `curated_collections` / `collection_items` (kuratierte Reihe)
`curated_collections`: `id` · `number: number` · `title: string` · `subtitle: string|null` · `is_active: boolean` · `created_at`, `updated_at`.
`collection_items`: `id` · `collection_id` · `product_slug: string` · `world: string|null` · `sort: number` · `created_at`.
Nutzer: `publicData.ts: useActiveCollection` (aktive Collection mit höchster `number`, Items nach `sort`). Verknüpfung zum Produkt läuft über **Slug**, nicht ID.
RLS: nicht in Auszug (wird ausgeloggt gelesen).

### 1.7 `wishlists`
Row: `id` · `user_id: string` · `product_id: string` · `created_at`.
Nutzer: `src/features/wishlist/useWishlist.ts` — `select product_id where user_id`, `insert {user_id, product_id}`, `delete where user_id and product_id`. Nur eingeloggt (Toast „Bitte anmelden").
RLS: nicht in Auszug. Anon: keine Merkliste ohne Konto (auch fachlich so gebaut).

### 1.8 `orders` (es gibt **keine** Tabellen `carts`, `order_items`)
Row: `id` · `user_id: string|null` · `status: "pending"|"paid"|"failed"|"refunded"|"expired"` · `fulfillment_status: "new"|"in_progress"|"packed"|"shipped"|"delivered"` · `items: Json` · `amount_total: number` (Cent) · `currency: string` · `customer_email: string|null` · `buyer_locale: string` · `stripe_session_id`, `stripe_payment_intent_id`, `stripe_charge_id` (`string|null`) · `connected_account_id`, `destination_account` (`string|null`) · `application_fee_cents: number|null`, `application_fee_refunded_cents: number` · `net_amount_cents`, `vat_amount_cents`, `vat_rate` (`number|null`) · `shipping_amount_cents: number` · `shipping_name/_line1/_line2/_city/_postal_code/_country: string|null` · `carrier`, `tracking_number: string|null` · `paid_at`, `shipped_at`, `delivered_at`, `refunded_at: string|null` · `refunded_amount_cents: number` · `invoice_number`, `invoice_path`, `invoice_issued_at`, `invoice_error: string|null`, `invoice_kleinunternehmer: boolean|null` · `confirmation_email_sent_at`, `shipped_email_sent_at`, `last_email_error` · `dispute_status`, `dispute_updated_at` · `created_at`, `updated_at`.
`items`-Format = Checkout-Zeilen: `{ name: string; unit_amount: number (Cent); qty: number; slug?: string; size?: string; product_id?: string }[]` (`create-checkout/index.ts: interface Line`). Serverseitige Auswertung joint über `item->>'slug'` (`customer_behavior_segments`).
Warenkorb selbst lebt **nur clientseitig** im `src/core`-Event-Store (`commands.addToCart` etc., `src/store/cart.tsx`, `src/features/commerce/korb.ts`); Persistenz über `domain_events` nur für eingeloggte (Adapter `createSupabaseAdapter`, Whitelist `includes` — nicht im Auszug).
Nutzer: `Account.tsx` (`id, created_at, status, fulfillment_status, amount_total, items, tracking_number, carrier, invoice_number` where `user_id`), `OrderConfirmation.tsx` (`id, status` where `stripe_session_id`, 5 Versuche à 1,5 s), `DnaBelege.tsx`/`DnaCover.tsx` (`id, items, created_at` where `status='paid'`). Schreiben nur über Edge Function `create-checkout` (service role) und Stripe-Webhook.
RLS: nicht in Auszug. `OrderConfirmation.tsx` kommentiert: Gast ohne Konto darf die Zeile „womöglich gar nicht lesen" → Gast-Bestellungen (user_id null) sind für anon vermutlich nicht sichtbar.

### 1.9 `customer_measurements` (Körpermaße)
Row: `user_id: string` (PK) · `height_cm`, `shoulder_cm`, `chest_cm`, `waist_cm`, `hip_cm`, `inseam_cm`, `foot_cm: number|null` · `fit_preference: string` (`eng|gerade|weit`) · `room_note: string|null` · `created_at`, `updated_at`.
Nutzer: `src/features/fit/useMyMeasurements.ts` — select/upsert(`onConflict: user_id`)/delete, nur eingeloggt.
RLS: nicht in Auszug. Kein anon-Zugriff (fachlich per Konto).

### 1.10 `user_memory` (Kunden-Gedächtnis / DNA-Persistenz)
Row: `user_id: string` (PK) · `preferences: Json` · `facts: Json` (string[]) · `updated_at`.
`preferences`-Schlüssel, die tatsächlich geschrieben werden (pawn-chat, generate-dna-voice, Frontend): `welt`, `stimmung` (`ruhig|kante`), `anlass`, `mag:<ontology_kind>` (z. B. `mag:material`), `ziel` (Freitext), `dna_chat_verlauf: {id, role, text, at}[]` (max 40), `stilberater` (Ergebnisobjekt, s. 3.7), `stilberater_dismissed: string[]`, `weg`, `weg_snapshot: {visits, orders, bilder}`.
Nutzer: `personalization/index.tsx` (liest `preferences`), `DnaChat.tsx`, `DnaKompass.tsx` (update `preferences.ziel`), `useStilberater.ts`, `DNA.tsx` (update `facts`).
RLS (Migration `20260708182737`): `memory_owner_read/update/delete` `TO authenticated USING (auth.uid() = user_id)`; **kein INSERT für authenticated** — die Zeile entsteht nur serverseitig (pawn-chat/generate-dna-voice upsert per service role). Frontend-`update` auf nicht existierende Zeile ist ein No-op. Anon: nichts.

### 1.11 `style_references` (hochgeladene Stilbilder)
Row: `id` · `user_id` · `url: string` (signierte URL, 1 Jahr) · `path: string` (Storage-Pfad) · `beschreibung: string|null` (Bild-Terme) · `herkunft: string` (`'bild'`) · `created_at`.
Nutzer: `DnaChat.tsx` (select/delete), `DNA.tsx` (delete all). Insert nur serverseitig durch pawn-chat.
RLS (Migration `20260811090000`): `user reads/inserts/deletes own` `TO authenticated`; `admin reads all`.

### 1.12 `domain_events` (Event-Log; Geschmackssignale)
Row: `id: string` · `at: string` · `actor: string` · `type: string` · `cause: string|null` · `payload: Json` · `identity_scope: string|null` · `schema_version: number` · `created_at`.
Event-Typen im Public-Frontend/Edge: `ai.taste_signal` (payload `{raw, session_id, world, mood, occasion, terms: {term, kind}[], user_id?}` bzw. `{source:"image", session_id, user_id, image_urls, terms}`), `ai.response_logged`, `ai.signal_corrected`, `ai.memory_deleted`, `wishlist.added` (gelesen von generate-dna-voice), `designer.application_submitted`, `share.*`. Core-Store-Events (Warenkorb, Views) via `createSupabaseAdapter` mit `identity_scope = userId`.
Nutzer: `personalization/index.tsx` (`id, at, payload` where `type='ai.taste_signal' AND payload @> {user_id}`, limit 200; insert `ai.signal_corrected`), `DNA.tsx` (insert `ai.memory_deleted`), `src/core/adapters/supabase.ts`.
RLS (Migration `20260701080228`): SELECT `identity_scope = auth.uid()`; INSERT `identity_scope = auth.uid() AND (actor = auth.uid()::text OR actor='system')`; `GRANT SELECT, INSERT TO authenticated`. **Anon: kein Zugriff.** Achtung: pawn-chat schreibt `ai.taste_signal` ohne `identity_scope` (nur `payload.user_id`) — das Frontend-Select über `identity_scope` findet diese Zeilen nicht; `personalization` filtert deshalb über `.contains("payload", {user_id})`, was aber an der RLS (`identity_scope = auth.uid()`) scheitert, sofern keine spätere Policy existiert. Aus dem Auszug nicht auflösbar — als Risiko markiert.

### 1.13 `page_visits`
Row: `id` · `user_id` · `target_type: string` (`designer|product`) · `target_id: string` · `visit_count: number` · `dwell_seconds: number` · `first_seen_at`, `last_seen_at`.
Schreiben nur über RPCs `record_page_visit`, `add_dwell_seconds` (SECURITY DEFINER, `auth.uid()`), Hook `src/features/personalization/usePageVisit.ts` (Heartbeat 20 s, sichtbarer Tab). Lesen: `DnaBelege.tsx`, `DnaCover.tsx` (`target_id, visit_count, dwell_seconds`).
RLS (Migration `20260807090000`): `user reads own` `TO authenticated`; RPC-Grants nur `authenticated`. **Anon wird bewusst nicht gezählt.**

### 1.14 `pawn_signals` (anonymer Nutzungs-Signalstrom)
Row: `id` · `quelle: string` · `kind: string` · `pattern: Json` · `weight: number` · `world: string|null` · `created_at`.
Frontend-Writer `src/lib/pawnSignal.ts: schreibePawnSignal` (quelle `'studio'`, kinds `funktion_genutzt|funktion_ignoriert|zug_erledigt|zug_uebersprungen|deck_frage|automatik_an|automatik_aus`) — im Auszug nur Studio-Nutzung. RLS: nicht in Auszug.

### 1.15 `ai_sessions` (Chat-Sitzung, serverseitig)
Row: `session_id: string` · `user_id: string|null` · `extracted: Json` (`{world, mood, occasion, browsing, bild_deskriptor}`) · `turns: number` · `created_at`, `updated_at`. Nur von pawn-chat (service role) gelesen/geschrieben. RLS: nicht in Auszug; kein direkter Frontend-Zugriff.

### 1.16 `message_threads` / `messages` (Anfragen an ein Haus)
`message_threads`: `id` · `designer_id: string` · `created_by: string` · `subject: string` · `category: "allgemein"|"auszahlung"|"kampagne"|"produkt"|"technik"` · `status: "open"|"closed"` · `product_id: string|null` · `last_message_at` · `created_at`, `updated_at`.
`messages`: `id` · `thread_id` · `sender_id` · `body: string` · `created_at`.
Nutzer: `src/features/messages/customRequest.ts: createCustomRequestThread` (insert Thread `category:'produkt'` + erste Message, dann `notify-designer-inquiry`), `useMessages.ts` (`select *`, Realtime `postgres_changes` auf beiden Tabellen, `sendMessage`, `createThread`), `commerce/hooks.ts: useMyRequestThreads` (Join `products:product_id(slug,name)`, `designers:designer_id(slug,brand_name)`). Anfragebogen im Heft (`heft/werk.tsx`) verlangt Login.
RLS: nicht in Auszug. Anon: kein Zugriff (fachlich Login-Pflicht). Ein DB-Trigger schreibt `notifications` (laut Kommentar in `notify-designer-inquiry`).

### 1.17 `designer_applications` (Bewerbung)
Row: `id` · `user_id` · `brand_name: string` · `legal_name`, `location`, `country`, `website`, `instagram`, `story: string|null` · `tags: string[]|null` · `production_status: string|null` · `portfolio_paths`, `avatar_path`, `banner_path` · `acquisition_lead_id: string|null` · `status: string` (`draft|submitted|…`) · `submitted_at`, `reviewed_at`, `reviewed_by`, `rejection_reason`, `admin_notes`, `ai_review_summary: Json|null` · `created_at`, `updated_at`.
Nutzer: `Apply.tsx` (`status, brand_name` where `user_id`), `displayName.ts` (`legal_name, brand_name`). Schreiben nur über `submit-application`.
RLS (Migration `20260703183458`): `applicant reads own`, `applicant inserts own`, `applicant updates draft` `TO authenticated`. Anon: nichts.

### 1.18 `contract_versions`
Row: `id` · `kind: string` (`designer`, `designer_terms`, …) · `version: number` · `title` · `body_markdown`, `body_markdown_en: string|null` · `checksum` · `effective_from`, `effective_to: string|null` · `created_at`.
Nutzer: `Apply.tsx` (`kind in (designer, designer_terms) AND effective_to IS NULL`).
RLS: `"contracts readable by all" FOR SELECT USING (true)` → anon liest.

### 1.19 `contact_messages`
Row: `id` · `name` · `email` · `subject` · `body` · `user_id: string|null` · `status` · `handled_at`, `handled_by` · `created_at`. Nur über Edge Function `submit-contact` geschrieben. RLS: nicht in Auszug.

### 1.20 `site_content` (CMS-Texte, Landing/Vision)
Row: `key: string` (PK) · `value: Json` · `value_en: Json|null` · `value_en_source: string|null` · `updated_at`, `updated_by`.
Nutzer: `src/lib/siteContent.ts` (lädt **alle** `key, value`, Cache 60 s; typisiert nur `ausgabe_nummer`), `publicData.ts` (`show_seed_content`), Komponente `Editable`/`useContentValue` (nicht im Auszug; liest laut Migrations-Kommentar `value` vor JSX-Fallback). Schlüsselregister: `src/lib/contentRegistry.ts` (`CONTENT_REGISTRY: {key, page, label, type: text|multiline|image}[]`, Gruppen Landing, Neu, Welt·Mode/Interior/Kunst, Welt (gemeinsam), Content-Begleiter, Designer-Verzeichnis, Bewerben, Plan, Funnel, Footer). Vision-Schlüssel per Migration `20260925`: `vision_kicker`, `vision_kette_talent|ausdruck|sichtbarkeit|bewegung|identitaet|transformation`, `vision_haltung`, `vision_cta`; Landing: `landing.cover_kicker`, `landing.from_houses_title`. Heft-Schlüssel z. B. `heft.innenumschlag` (`AusgabeHeft.tsx`).
RLS: nicht in Auszug; wird ausgeloggt gelesen („Public read, admin write" laut Kommentar).

### 1.21 `i18n_overrides` / `ui_translations`
`i18n_overrides`: `key: string` · `value_en: string` · `value_en_source: string|null` · `updated_at`. Vom `I18nProvider` beim Start komplett geladen; gilt nur für `locale === "en"` und überschreibt den statischen Dict-Eintrag.
`ui_translations`: `hash`, `de`, `en`, `created_at`, `updated_at` — Cache der Auto-Übersetzung (`@/lib/autoTranslate`, nicht im Auszug).
RLS: nicht in Auszug (anon liest).

### 1.22 `profiles`
Row: `id` · `display_name: string` · `locale: string` · `consent_analytics`, `consent_memory`, `consent_personalization: boolean` · `member_number: number|null` · `created_at`, `updated_at`.
Nutzer: `lib/auth.tsx: loadProfile`, `personalization/index.tsx` (`consent_personalization`), `Account.tsx` (`member_number`). Angelegt durch Trigger `handle_new_user()`.
RLS: `profile self read/insert/update` `TO authenticated`.

### 1.23 `user_roles`
Row: `id` · `user_id` · `role: "customer"|"designer"|"admin"|"designer_applicant"` · `created_at`. `auth.tsx: loadRoles`. RLS: `users read own roles`. RPC `has_role(_user_id, _role)`.

### 1.24 `ai_config`
Row: `key` · `value: Json` · `updated_at`, `updated_by`. Frontend liest `plans`, `model_tiers` (`planGate.ts`), `matching_weights` (`personalization`). Edge Functions lesen viele Schlüssel (`persona_customer|designer|admin`, `pawn_chat_persona`, `directives`, `house_style_law`, `voice_law`, `provider_priority`, `model_tiers`, `pawn_chat_rate_limits`, `platform_commission`, `ai_action_costs_cents`, `staging_templates`). RLS: nicht in Auszug; Kommentar in pawn-chat spricht von „Client-Allowlist" (bestimmte Keys anon lesbar).

### 1.25 `fashion_ontology`
Row: `id` · `term: string` · `kind: "category"|"silhouette"|"material"|"color"|"attribute"|"style"|"mood"` (classify-term schreibt zusätzlich `era|technik|finish` — Enum in types.ts kennt die nicht) · `synonyms: string[]` · `world: string[]` · `parent_term` · `learned: boolean`. RLS: `ontology_public_read USING (true)`. Frontend im Auszug liest sie nicht direkt; pawn-chat matcht User-Text dagegen.

### 1.26 `cultural_currents`
Row: `id` · `name` · `zeitraum` · `worlds: string[]` · `nahe_haeuser: string[]` · `ontologie_begriffe: string[]` · `visuelle_merkmale: Json` · `praegende_kuenstler: Json` · `quellen: Json` · `quelle_typ` · `ausloeser` · `zuversicht`. `personalization/index.tsx` liest `name, nahe_haeuser, worlds` ausgeloggt. RLS: nicht in Auszug.

### 1.27 `referrals`, `acquisition_leads` (nur via RPC)
`Einladung.tsx` / `Apply.tsx` lesen Lead-Daten ausschließlich über RPC `get_lead_invitation`. `OrderConfirmation.tsx` ruft `grant_referral_credit`. Keine direkte Tabellenlektüre.

### 1.28 Tabellen, die es **nicht** gibt (obwohl im Auftrag genannt)
- `hausseite_bausteine` / `house_blocks`: heißt `designer_page_blocks`.
- `carts`, `order_items`: existieren nicht; Korb clientseitig, Positionen als `orders.items` JSON.
- `customer_genome`, `genom_karte`: Migration `20260723094500_genom_karte.sql` erweitert nur `jarvis_reports.kind` um `'wissen'`. Es gibt keine Genom-Tabelle. `GenomeCard.tsx` ist eine reine Darstellungskomponente (`strands: {label, value 0–100}`), `CustomerGenomeCard.tsx` berechnet die Stränge clientseitig aus `worldDistribution`.
- `customer_behavior_segments`: keine Tabelle, sondern RPC (admin-only).
- `consent`: keine Tabelle; Cookie/localStorage (s. 4.3) + `profiles.consent_*`.
- `invoices`: kein Table, sondern Storage-Bucket (`Account.tsx`).
- `page_visits` zählt nur eingeloggte; „customer events" = `domain_events` (eingeloggt) + Plausible (`src/lib/analytics.ts`, cookielos, Events `start_begonnen|zug1_abgeschlossen|zug2_abgeschlossen|zug3_abgeschlossen|live_gegangen|anfrage_gesendet`).

### 1.29 `first_move_sessions` (nur Migration, nicht in types.ts)
`user_id` PK · `step: 'zeigen'|'bestaetigen'|'ziehen'` · `brand_name`, `location`, `country` · `about_text`, `about_source: 'voice'|'chips'` · `works: jsonb` (`{id, kind: original|print|auftragsarbeit|live_portrait, image_url, title, description, price_cents}[]`) · `shipping_de_eu` · `billing: jsonb`. RLS: eigene Zeile `TO authenticated`. Von `pages/FirstMove.tsx` (/start, Künstler-Onboarding — nicht Kunden-Frontend) genutzt.

### 1.30 Enums (types.ts)
`app_role`, `designer_plan: haus|atelier|maison`, `inventory_mode: stock|made_to_order`, `product_status: draft|published|archived`, `product_world: Mode|Interior|Kunst`, `order_status: pending|paid|failed|refunded|expired`, `fulfillment_status: new|in_progress|packed|shipped|delivered`, `page_block_kind` (s. 1.3), `message_category`, `message_status`, `media_kind: bild|video`, `media_origin: upload|erzeugt|edition`, `media_review_status`, `ontology_kind`, `video_source`, `campaign_*`, `posting_*`, `generation_*`.

---

## 2. RPCs (`supabase.rpc`) aus dem öffentlichen Frontend

| RPC | Args | Returns | Grant / Bedingung | Aufrufer |
|---|---|---|---|---|
| `record_page_visit` | `p_target_type: text ('designer'\|'product')`, `p_target_id: uuid` | void | `authenticated`; no-op wenn `auth.uid()` null | `usePageVisit.ts` |
| `add_dwell_seconds` | `p_target_type`, `p_target_id`, `p_seconds: int` (1–300) | void | `authenticated` | `usePageVisit.ts` |
| `bump_media_metric` | `p_media_asset_id: uuid`, `p_metric: 'views'\|'shop_clicks'` | void | `anon, authenticated`, SECURITY DEFINER | `HausseiteBlocks.tsx: ShopLink` |
| `bump_product_view` | `p_product_id: uuid` | void | `anon, authenticated`; nur `status='published'` | Migration vorhanden; im Auszug kein Aufruf |
| `get_lead_invitation` | `_ref_code: string` | `{handle, language, lead_type, personal_line, plate_images: Json, plate_number, plate_status, world}[]` | nicht in Auszug (ausgeloggt aufgerufen) | `Einladung.tsx`, `Apply.tsx` |
| `count_founding_designers` | — | number | nicht in Auszug | `Einladung.tsx` |
| `get_founding_social_proof` | — | `{brand_name, world}[]` | nicht in Auszug | `Einladung.tsx` |
| `grant_referral_credit` | `p_order_id: string`, `p_ref_code: string` | Json `{ok?}` | nicht in Auszug (prüft serverseitig bezahlt/kein Selbstkauf/erste Bestellung) | `OrderConfirmation.tsx` |
| `first_move_publish` | — | jsonb | `authenticated`, SECURITY DEFINER (legt Haus + Werke an) | `FirstMove.tsx` (nicht in types.ts) |
| `merge_anon_session` | `_session_id: string`, `_user_id: string` | number (merged) | nur via Edge Function `merge-session` (service role) | — |
| `has_role` | `_user_id`, `_role` | boolean | — | Edge Functions |
| `designer_product_engagement` | `p_designer_id` | `{product_id, total_visits, unique_visitors, avg_dwell_seconds, returning_visitors}[]` | eigenes Haus/Admin | generate-dna-voice |
| `customer_behavior_segments` | — | `{segment, kunden, anteil, merkmal, avg_bestellungen}[]` (Beobachter/Gezielt/Sammler/Streuner) | **admin-only** (`raise not_authorized`) | Admin |
| `trend_momentum` | `_world: text` | `{term, world, latest_score, ema7, slope, forecast14, momentum, history}[]` | `authenticated` | pawn-chat (service role) |
| `ist_verkaufsbereit`, `ist_kauf_freigeschaltet` | `_designer_id` | boolean | Trigger-Helfer | DB-intern |
| Studio/Admin-only (nicht öffentlich): `book_ai_spend`, `book_credit_spend`, `plan_usage_inkrement`, `plan_usage_stand`, `designer_level`, `recompute_brand_dna`, `approve_designer`, `reject_designer`, `notify_admins`, `slugify`, `rochade_stand`, u. a. | | | | |

---

## 3. Edge Functions (öffentliches Frontend)

Alle unter `https://rnakubexbqfgfciynqpt.supabase.co/functions/v1/<name>`, aufgerufen per `supabase.functions.invoke(name, {body})` — der Client sendet `apikey` (anon key) und `Authorization: Bearer <session-JWT oder anon key>`. `verify_jwt` ist per `supabase/config.toml` **nur** für `submit-contact`, `submit-application` (und Webhooks/Seeds) abgeschaltet; alle anderen verlangen einen gültigen JWT am Gateway — der anon key ist selbst ein JWT, ausgeloggte Aufrufe kommen also durch. Die Funktionen ermitteln `user_id` selbst durch Dekodieren von `sub` aus dem Bearer-Token (ohne Signaturprüfung, außer `merge-session`/`submit-application` via `auth.getClaims`). Kein Streaming — alle antworten mit einem JSON-Objekt. Fehler kommen fast immer als HTTP 200 mit `{ok:false|error, message}`.

### 3.1 `pawn-chat` (1236 Zeilen) — der Begleiter-Chat
Auth: anon **oder** Session-JWT. Ohne `sub` → Rolle `customer`, kein Gedächtnis.
Request-Body:
```ts
{
  messages: { role: "user"|"assistant"|"system"; content: string }[]; // letzte 20 werden genutzt
  session_id?: string;            // Client-UUID aus localStorage "palace.chat.session_id"; fehlt → Server erzeugt
  probe?: boolean;                // nur Admin-Statusbadge: {provider, providers, chain}
  image_url?: string; image_urls?: string[]; // max 6, öffentlich abrufbare (signierte) URLs
  image_paths?: string[];         // Storage-Pfade parallel zu image_urls (für style_references.path)
  persist_thread?: boolean;       // Verlauf in user_memory.preferences.dna_chat_verlauf sichern (nur eingeloggt)
  page_context?: { route?: string; product_slug?: string };
  mode?: "erste_partie";          // Designer-Onboarding (Studio) — separater Zweig
  partie_aktion?, schwerpunkte_gewaehlt?, automatik_zustimmung? // nur mode erste_partie
}
```
Response (Chat):
```ts
{ reply: string; cards: { kind: "product"|"designer"; title; subtitle?; href; reason? }[] /*max 4*/;
  action: { type: "navigate"; path; label } | null; session_id; provider: "openai"|"anthropic"|"lovable_gateway"|"fallback";
  tier: "standard"|"plus"|"max"; image_terms: string[] }
```
429: `{ reply, rate_limited: true }` (Limits aus `ai_config.pawn_chat_rate_limits`, Default 20/min je User, 40/min je IP; Tabelle `rate_limit_hits`). Fehlerpfad: 200 mit generischer `reply`.
Modelle: Text via Kette `provider_priority.chain` (Default openai → anthropic → lovable_gateway → regelbasierter Fallback); Modell je Tier aus `ai_config.model_tiers` (Default `gpt-4o-mini`, Plus/Max `gpt-4o`); Tier hängt am **Designer-Plan**, Kunden sind immer `standard`. Anthropic-Pfad: `claude-sonnet-4-5`, max_tokens 1024. Bild-Turns immer `gpt-4o` (OpenAI Vision, `image_url`-Content-Parts); ohne `OPENAI_API_KEY` werden Bilder **nicht** analysiert.
Kontext-Aufbau (System-Prompt, in dieser Reihenfolge): Persona (`ai_config.persona_<role>`), `house_style_law`, `CATALOG_HONESTY_LAW` (nie erfundene Produkte), `REGISTER_LAW_HINT`, `voice_law` (nur wenn `page_context.route === "/dna"`), House-Tone (Produktseite), Studio-Hinweise (nur Designer), `directives`. Context-Hint: «PRODUKTFAKTEN» (bei `product_slug`: `name, world, description, designer_note, product_dna, tags, price, made_in, care_instructions, edition_info, lead_time_days, inventory_mode, length/width/height_cm` + Welt-Felder), «ERINNERUNGEN» (user_memory: letzte 4 facts, 6 preferences), Bild-Gedächtnis (`ai_sessions.extracted.bild_deskriptor`), Katalog-Treffer/Trend/Wissen-Hints.
Heuristiken: `detectWorld`, `detectMood` (ruhig/kante), `detectBrowsing`, `extractOccasion` („für …"), `detectNavIntent`; Katalog-Retrieval nur bei Produkt-/Stil-Intent oder wenn Welt+Stimmung bekannt (`scoreProduct` gegen `products.tags/product_dna/description`, max 3 Cards, `href: /product/<slug>` — alte Adresse, wird per 301 nach `/werk/` umgeleitet). Navigation: `/dna`, `/cart`, `/neu`, `/mode|/interior|/kunst`, `/designers`, `/designer/<slug>`, `/product/<slug>`, `/studio/copilot`.
Bild-Pipeline: Vision-Call liefert JSON `{kleidungstyp, farben, materialien, silhouette, stil_tags}` (je 2–5 deutsche Begriffe, „Beobachtung, nie Bewertung") → gemerged in `ai_sessions.extracted.bild_deskriptor` → als Text in Folgeturns. Eingeloggt: Insert `style_references` (url, path, beschreibung = Terme). Immer: `domain_events` `ai.taste_signal` (source image).
Side effects je Turn: `ai_sessions` upsert; `domain_events` insert `ai.taste_signal` + `ai.response_logged`; eingeloggt `user_memory` upsert (`welt`, `stimmung`, `anlass`, `mag:<kind>`, `facts` per Regex „ich bin/heiße/arbeite als/wohne in/mag/liebe/hasse/trage/suche …", auf `/dna` `ziel` per Regex „ich will/möchte/würde gerne/wünsche mir …", bei `persist_thread` `dna_chat_verlauf`).
Frontend-Aufrufer: `DnaChat.tsx` (`persist_thread: true`, `page_context: {route:"/dna"}`, Bilder), `ProductServiceSheet.tsx` (`page_context: {route: "/product/<slug>", product_slug}`), Heft-Sektion „Frag PAWN" (Suche; Implementierung in `heft/spreads/index.tsx`, nicht im Detail geprüft).
**Nicht vorhanden:** Streaming, System-Prompt-Override durch Client, strukturierte Quiz-Antworten, Bild-Analyse auf Hautton/Untertöne/Raum (Prompt ist auf Mode-Moodboards festgelegt), Rückgabe von Produktbildern in `cards`.

### 3.2 `create-checkout` — Stripe Checkout Session
Auth: anon oder JWT (`user_id` optional → Gast-Bestellung mit `orders.user_id = null`). Benötigt `STRIPE_SECRET_KEY`, sonst 200 `{error:"not_configured", message}`.
Body:
```ts
{ items?: { name: string; unit_amount: number /*Cent*/; qty: number; slug?: string; size?: string; product_id?: string }[];
  success_url?: string;  // Default `${origin}/order/success?session_id={CHECKOUT_SESSION_ID}`
  cancel_url?: string;   // Default `${origin}/cart?checkout=cancelled`
  customer_email?: string; locale?: "de"|"en";
  mode?: "payment"|"subscription"|"credits"; price_id?; plan?: "atelier"|"maison"; credits?  // Studio-Modi
}
```
Einzelkauf-Logik: Zeilen mit `name && unit_amount>0 && qty>0`; `slug` → `products.designer_id`; **mehr als ein Haus → 200 `{error:"mixed_cart", message}`**. Ein Haus: liest `designers.stripe_account_id, stripe_charges_enabled, shipping_rates`; ist das Haus kein Admin-Haus, prüft `fehlendeVerkaufsbedingungen()` (Stripe charges, `designer_billing_profiles` vollständig, Versandkosten gesetzt) → sonst 200 `{error:"designer_not_ready", fehlt: string[], message}`. Provision `ai_config.platform_commission.pct` (Default 7 %) nur auf Warenwert → `application_fee_amount`, Direct Charge auf `stripeAccount`. Admin-Haus: Plattformkonto. Legt **vor** Stripe `orders` an (`status:'pending'`, `items`, `amount_total`, `currency:'eur'`, `customer_email`, `application_fee_cents`, `destination_account`, `connected_account_id`, `buyer_locale`), Stripe-Metadata `{order_id, platform:"pawn", connected_account?}`. Stripe: `mode:"payment"`, automatic payment methods (Apple/Google Pay, PayPal, Klarna, Karte), `shipping_address_collection` (DE AT CH FR IT NL BE LU ES DK SE FI IE PT), `shipping_options` für Zonen inland/eu/world aus `designers.shipping_rates` (`flat_cents`, `free_from_cents`), `billing_address_collection:"auto"`, `line_items` mit `price_data` (kein Stripe-Product).
Response: `{ url: string; id: string }` (Session-URL zum Redirect) oder 500 `{error}`. Bezahlt-Status setzt der Stripe-Webhook (nicht im Auszug); Frontend pollt `orders.status` per `stripe_session_id`.
Aufrufer: `pages/Checkout.tsx`, `heft/kasse.tsx` (`name: "<Produkt> · <Größe>"`, `unit_amount: Math.round(price*100)`, `success_url …&haus=<slug>`).

### 3.3 `notify-designer-inquiry`
Auth: **JWT Pflicht** (401 `{ok:false, error:"auth_required"}`). Body `{ thread_id: string }`. Prüft `message_threads.created_by === user`, holt Designer-E-Mail via `auth.admin.getUserById`, sendet Resend-Mail (`from no-reply@post.pawn.vision`, Link `https://pawn.vision/studio/nachrichten?t=<id>`). Response immer `{ok:true}`. Reine E-Mail-Ergänzung; die In-App-Benachrichtigung schreibt ein DB-Trigger.

### 3.4 `submit-application` (`verify_jwt=false`)
Auth: optional JWT (`auth.getClaims`); ohne → legt User per `auth.admin.createUser` an (`email_confirm:false`, `user_metadata.intent:"designer"`), generiert Signup-Link (redirect `/apply`).
Body: `{ email?, password?, displayName?, brandName (Pflicht, ≥2), legalName?, location?, country?, website?, instagram?, story?, tags?: string[], productionStatus?, portfolioPaths?: string[], acceptedContractIds: string[] (Pflicht, ≥1), acquisitionLeadId?, ref? }`.
Side effects: upsert `designer_applications` (`onConflict: user_id`, `status:'submitted'`), `acquisition_leads.status='beworben'`, upsert `designer_consents` (`checksum_at_accept`, `user_agent`), insert `domain_events` `designer.application_submitted`.
Response: 200 `{ ok:true, application_id, needs_email_confirmation }`; 400 `brand_name_required|contracts_required|email_password_required`; 409 `email_in_use_signin_required`.

### 3.5 `submit-contact` (`verify_jwt=false`)
Body `{ name, email, subject?, body, user_id? }` → insert `contact_messages`. Response `{ok:true, id}`; 400 `missing fields`. Anon ok.

### 3.6 `merge-session`
Auth: **JWT Pflicht** (validiert per `auth.getClaims`; 401 `unauthorized|invalid_session`). Body `{ session_id?: string }` → RPC `merge_anon_session(_session_id, _user_id)` (service role). Response `{ merged: number }`. Aufruf: `lib/auth.tsx` beim `SIGNED_IN`-Event mit `localStorage["palace.chat.session_id"]`. Was genau gemerged wird, steht in der RPC (nicht im Auszug) — laut Header-Kommentar „anonymous taste signals + chat session" (`ai_sessions.user_id`, `domain_events.payload.user_id`).

### 3.7 `generate-dna-voice` — DNA in Prosa (Claude `claude-sonnet-4-5`)
Auth: **JWT Pflicht** (401 `{error:"auth_required"}`). Ohne `ANTHROPIC_API_KEY`: 200 `{ok:false, error:"not_configured", message}`.
Body: `{ mode: "kunde"|"designer"|"weg"|"passt"; designer_id?: string; produkt_slug?: string; locale?: "de"|"en" }`.
- `kunde` (Stilberater): Schwelle `page_visits ≥ 20` **oder** `orders(paid) ≥ 3`, sonst `{ok:true, fruehzustand:{erreicht:false, aktuell, ziel:20}}`. Material: `user_memory.preferences.mag:*`, `ai.taste_signal.payload.message`, Visit-Count, Bestellungen, `wishlist.added`-Events. Response: `{ ok, fruehzustand, urteil, einordnung, stilname, belege: {text, beleg}[3], blinder_fleck: {text, beleg}, naechster_schritt: {text}, generated_at }`; wird in `user_memory.preferences.stilberater` gecacht.
- `weg`: braucht `preferences.ziel`, sonst `{fruehzustand:{erreicht:false, grund:"kein_ziel"}}`. Response `{ ok, ziel, schritte: {text, produkt_slug|null, begruendung}[3], fortschritt|null, generated_at }` (Slugs gegen 40 published Produkte validiert); Cache `preferences.weg`, `weg_snapshot`.
- `passt` („Steht mir das?"): Body `produkt_slug` (400 `missing_produkt_slug`). Schwelle: `ziel` oder `stilberater.urteil` oder Visits/Käufe. Response `{ ok, fruehzustand, passt: boolean, urteil, alternative_slug|null, alternative_grund|null, generated_at }`. Nicht gecacht.
- `designer` (Außenauge): Studio; schreibt `designers.aussenauge`.
Aufrufer: `useStilberater.ts` (kunde), `DnaKompass.tsx` (weg), `PasstDas.tsx`/`ProductServiceSheet.tsx` (passt).

### 3.8 `classify-term`
Auth: keiner geprüft (kein JWT-Check im Code; Gateway-verify_jwt gilt). Body `{ term: string; world?: string }`. Prüft `fashion_ontology` (term/synonym), sonst OpenAI `gpt-4o-mini` JSON `{canonical, kind, world[], synonyms, duplicate_of?}` → insert/merge `fashion_ontology`, Log `ai_actions_log`. Response `{skipped}|{known, term}|{merged_into}|{inserted: row}`. Öffentliches Frontend im Auszug ruft es nicht auf (Studio-Tagging).

### 3.9 `analyze-artwork` (First Move, Zug „Zeigen")
Auth: **JWT Pflicht**. Body `{ source_url: string }` (öffentlich abrufbare URL; Funktion lädt Bild als base64 → Claude Vision `claude-sonnet-4-5`, max_tokens 500). Fester Prompt: Kunstwerk → `{titel, beschreibung, preis_min_eur, preis_max_eur}`. Response `{ ok, title, description|null, price_cents_min|null, price_cents_max|null }` oder 200 `{ok:false, error: not_configured|image_unreadable|detect_failed, message}`. Keine Budget-Buchung.

### 3.10 `detect-object` (Studio, Inszenierung)
Auth: JWT + Body `{ designer_id, source_url }`; 403 wenn nicht eigenes Haus/Admin. Claude Vision, Prompt „Produktfoto": Response `{ ok, ambiguous, art: kleidung|keramik|malerei|skulptur|moebel|schmuck|textil|objekt|sonstiges, material|null, farben[≤3], merkmale[≤4], groessenhinweis|null, foto: {schaerfe, licht, hintergrund_stoert, verdeckt}, foto_hinweis|null }`. Bucht `book_ai_spend` (`ai_action_costs_cents.staging_detect`, Default 3 ct).
**Bewertung „Foto → Hautton/Unterton" oder „Raumfoto":** Keine der drei Vision-Funktionen (pawn-chat, analyze-artwork, detect-object) hat einen Prompt oder ein Ausgabeschema dafür. `detect-object` verlangt zudem `designer_id` (Haus), `analyze-artwork` ist auf Kunstwerke festgelegt, pawn-chat liefert nur Kleidungs-/Farb-/Material-/Silhouetten-Terme in Freitext-Arrays. Technisch wären alle drei Muster (URL rein, JSON raus) wiederverwendbar, es braucht aber eine **neue** Edge Function bzw. einen neuen `mode` mit eigenem Prompt/Schema — Deploy nur über Lovable (CLAUDE.md).

### 3.11 Weitere (nicht öffentlich)
`generate-house-theme` (`{designer_id?, action: generate|revert|manual, prompt?, manual?, revert_to_version?}` → `house_themes`), `studio-ai` (`mode: product_text|product_note|weekly_mirror|campaign_draft|aufbau|chat`), `order-fulfillment`, `haus-rochade`, `transcribe-voice` (von `FirstMove.tsx` aufgerufen, Code nicht im Auszug).

---

## 4. Auth, Session, Consent, i18n

### 4.1 Auth (`src/lib/auth.tsx`)
Supabase Auth direkt: `signInWithPassword(email, password)`, `signUp(email, password, displayName)` (`emailRedirectTo: origin + "/"`, `data.display_name`), `signInWithOAuth({provider:"google", redirectTo: origin + "/"})`. **Kein Magic Link** im Code. `useAuth()` liefert `{user, session, profile: {id, displayName, locale, consent:{personalization, memory, analytics}}, roles: Role[], loading, hasRole}`. Rollen aus `user_roles` (Trigger setzt sie; Retry nach 1,6 s bei Signup). Bei `SIGNED_IN`: `merge-session` mit `localStorage["palace.chat.session_id"]`. `Account.tsx` leitet Designer nach `/studio`.

### 4.2 Anonyme Sitzung
Zwei getrennte Konzepte:
- **Chat-Session-ID** `localStorage["palace.chat.session_id"]` (UUID, `DnaChat.tsx: getSessionId`), an pawn-chat gesendet, serverseitig `ai_sessions`; beim Login via `merge-session` → `merge_anon_session` ans Konto gehängt. Bei Consent „essential" gelöscht.
- **Sitzungsspur** `sessionStorage["pawn.sitzungsspur.v1"]` (`src/features/personalization/sitzungsspur.ts`): `{ werke: {slug, welt, haus}[] }` max 24, nur mit Consent `accepted`; Helfer `merkeAngesehen`, `weltDerSitzung` (≥2 Treffer), `haeuserDerSitzung`. Kein Serverzugriff. Speist „Deine Boutique" für Gäste.
Anonymes Stöbern wird serverseitig **nicht** gezählt (weder `page_visits` noch `domain_events`); einzig `bump_product_view`/`bump_media_metric` sind anon-fähig.

### 4.3 Consent (`src/lib/consent.tsx`)
Zwei Stufen, keine Kategorien: `ConsentValue = "accepted" | "essential" | null`. Speicher: Cookie `pawn_consent` (1 Jahr, SameSite=Lax) + `localStorage["pawn.consent.v1"]`. `accepted` → `allowsPersistence=true`, Google Consent Mode v2 alle vier Flags `granted`; `essential` → `denied` + löscht `pawn.personalization.cache.v1`, `palace.chat.session_id`, `pawn.anon.signal.queue`, Cookie `palace_session`. Banner (`ConsentBanner.tsx`) mit zwei Knöpfen. Kontobezogene Schalter liegen separat in `profiles.consent_personalization|consent_memory|consent_analytics` (Personalisierung liest Signale nicht, wenn `consent_personalization=false`).

### 4.4 i18n (`src/lib/i18n.tsx`, 340 KB)
API: `useI18n() → { locale: "de"|"en", setLocale, t(key, vars?), refreshOverrides }`. Statische Dicts `de`/`en` (Export `deDict`, `enDict`), Key-Typ aus `de`. Locale: `localStorage["pawn.locale"]`, sonst Browser (`navigator.languages[0]` beginnt mit `de` → de, sonst en), setzt `document.documentElement.lang`. Overrides: `i18n_overrides.key/value_en` beim Start geladen, gelten nur für `en`. Zusätzlich `autoTranslate` (DOM-Übersetzung nicht im Wörterbuch stehender Texte, Cache `ui_translations`) — läuft nur bei `en`. Vars-Syntax `{name}`.

---

## 5. Medien / Storage

Buckets im Auszug: `designer-media` (privat, Werkbilder), `campaign-assets`, `mediathek` (beide in `BUCKETS` von `media.ts`), `taste-uploads` (Kunden-Stilbilder, Pfad `<user_id>/dna/<ts>-<i>-<name>`, max 8 MB, Typen jpeg/png/webp/gif/heic/avif; signierte URL 1 Jahr), `invoices` (`<order_id>.pdf`, signiert 1 h), `designer-applications` (RLS: eigener Ordner `<uid>/…`), `staging-previews` (Admin/Service). `FirstMove.tsx` nutzt `designer-media` mit `getPublicUrl` — d. h. mindestens Teile des Buckets sind public lesbar, während `media.ts` von „privat" ausgeht.
URL-Bau (`src/lib/media.ts`):
- `mediaPfad(value)` erkennt `/storage/v1/object/(sign|public|authenticated)/<bucket>/<pfad>` oder nackten Pfad (→ `designer-media`); externe/`data:`/`blob:` bleiben unverändert.
- `signiereMedia(value)` → `createSignedUrl(pfad, 3600)`, Cache 45 min; Fallback auf gespeicherte http-URL.
- `useMediaUrl(value)` React-Hook.
- `bildVariante(url, {breite, guete=80})` schreibt `/object/(sign|public)/` → `/render/image/$1/…?width=&quality=` (Supabase Image Transformation, webp). `bildSatz(url, [640, 960, 1280])` baut `srcset`. Im Heft: `sizes="(max-width: 820px) 100vw, 50vw"`.
Es gibt **keine** vordefinierten Größenvarianten in der DB — nur on-the-fly Transformation. Produkt = genau ein `image_url`.

---

## 6. Passform (`src/features/fit/measurements.ts`)

Typen: `BodyMeasurements = { height_cm, shoulder_cm, chest_cm, waist_cm, hip_cm, inseam_cm, foot_cm: number|null; fit_preference: "eng"|"gerade"|"weit"; room_note: string|null }` (= Spalten von `customer_measurements`). `BODY_FIELDS` mit Labels/Hints (Körpergröße, Schulterbreite, Brustumfang, Taillenumfang, Hüftumfang, Innenbeinlänge, Fußlänge). `FIT_PREFERENCES` eng/gerade/weit.
Logik `computeFit(body, measurements: Measurements|null, sizes: string[]) → { possible, sizes: SizeFit[], best }`:
- `EASE_RANGE` (cm Luft): eng 0–8, gerade 3–14, weit 8–30.
- `ROW_TO_BODY`: Maßtabellen-Zeile per Regex → Körperwert: `/brust/`→`chest_cm` (umfang), `/taille/`→`waist_cm` (umfang), `/(h(ü|ue)ft|bund)/`→`hip_cm` (umfang), `/schulter/`→`shoulder_cm` (laenge), `/(innenbein|schritt)/`→`inseam_cm` (laenge).
- Je Größe, je relevanter Zeile: `ease = garment − body` (auf 0,1 gerundet). Toleranz: Umfang = EASE_RANGE[fit_preference]; Länge = {min −2, max 4}. `ease < min` → `knapp`, `ease > max` → `weit`, sonst `passt`. Schlechteste Zeile (größte Distanz) bestimmt Level und `reason` („Brustumfang +4 cm Spielraum" / „zu knapp an der taille (−1 cm)" / „sehr weit an der … (+18 cm)"). Keine Werte → `unbekannt`.
- `best` = erste Größe mit `passt`. Kein KI-Aufruf, keine Kosten. `possible=false` ohne Maßtabelle/Größen/Körperwerte.
Speicherung: `useMyMeasurements()` → `customer_measurements` upsert `onConflict: user_id`. UI: `FitVerdict.tsx` (an der Größenwahl, verlinkt `/dna#massband`), `MeasurementsPanel.tsx`. Produktseite braucht `products.measurements.rows/values` und `size_variants[].size`.
Für Interior/Kunst gibt es keine Passform-Logik (nur `room_note` als Freitext).

---

## 7. DNA-Modell (Ist-Zustand)

Es existiert **kein** einheitliches DNA-Schema, sondern vier Schichten:
1. **Core-Store-Genom** (`src/core/types/entities.ts`): `GenomeAxis = structure|edge|elegance|darkness|sensuality|utility`, `StyleGenome = Record<GenomeAxis, number>`, `DNA = {genome, signals: DNASignal[] (kind view|save|follow|purchase|dwell|prompt), mutations, version}`; Selektoren `dnaMatchForProduct`, `dnaAlignmentForDesigner`, `wardrobeImpactForProducts` (`src/features/dna/hooks.ts`). Rein clientseitig, `Product.genomeAffinity` ist für DB-Produkte leer (`korb.ts`). Praktisch unbenutzt für echte Daten.
2. **Personalisierungsprofil** (`src/features/personalization/index.tsx`): aus `domain_events` `ai.taste_signal` (nur eingeloggt) + `user_memory.preferences`: `PersonalizationProfile = {hasSignals, world, worldDistribution, mood: ruhig|spannung|neutral, preferredTags (≤12), preferredDesigners, signals, correctedIds}`. `parseSignal` liest `payload.world|mood|tag|message|verdict` (like ×2, skip verworfen). Setzt CSS-Variablen `--palace-gap`, `--palace-gap-md`, `--palace-reveal-dur`, `--palace-image-contrast` je Mood. `designerDna` Map aus `designers.brand_dna.worlds/signals`, `video_taste_weights` → `resonance`, `cultural_currents.nahe_haeuser` → `nearCurrent`.
   Scoring `scoreForPersonalization(item, profile, designerDna)`: Welt-Match +2; Tag/Kategorie-Overlap +1/+1; `product_dna`-Treffer gewichtet mit `ai_config.matching_weights` (Default mood 2, silhouette 1.5, material 1, colors 1); Designer-Welt-Gewicht ×2; Signal-Overlap ≤3; bevorzugter Designer +1.5; `nearCurrent` +0.5; `resonance` +≤1; Hash-Rauschen +≤0.4. `explainMatch` / `explainMatchWithBeleg` liefern Begründung + zählbaren Beleg.
3. **Kunden-Gedächtnis** `user_memory` (s. 1.10) — Freitext-Präferenzen, `ziel`, Chatverlauf, Stilberater-Urteil, Weg.
4. **Belege** aus `page_visits` + `orders` (`DnaBelege.tsx`: Rückkehrer ≥2 Besuche, Verweildauer ≥20 s, Kauf), `DnaCover.tsx`.
Signalquellen: pawn-chat (Text/Bild → `ai.taste_signal`, `user_memory`), `usePageVisit` (RPC), `useWishlist`, Core-Commands `recordProductView|saveProduct|followDesigner` (`useCustomerEvents.ts`; Persistenz-Whitelist nicht im Auszug), Sitzungsspur (Gast, sessionStorage).
Empfehlungen: `DeineBoutique.tsx` baut Reihen (je 2–6 Werke, kein Werk doppelt): 1) Häuser aus `preferredDesigners` bzw. `haeuserDerSitzung`; 2) Stimmung per Wortliste gegen `name + product_dna` (ruhig: „ruhig schlicht klar leinen wolle natur minimal", spannung: „kontrast schwarz kante struktur grafisch stark"); 3) bis zwei `preferredTags` als Substring; weitere Reihen im Rest der Datei. Alles clientseitig über 200 geladene Produkte. `useStilberater` → Prosa-Urteil (Server). Es gibt keine serverseitige Empfehlungs-RPC.
`customer_behavior_segments` ist eine Admin-Aggregation (vier Segmente), nicht per Kunde abrufbar.

---

## 8. Bestehendes „Heft" im Repo

Zwei Implementierungen:
- **`src/features/heft/*`** (Teil M1, „Wendel"): 3D-Blatt-Simulation (`Heft.tsx`, `wendel.ts`, `Eroeffnung.tsx`, `heft.css`), gemountet von `pages/AusgabeHeft.tsx` unter `/ausgabe/001` und `/ausgabe/001/:seite` (lazy). Lädt **keine** DB-Daten außer `site_content` über `Editable` (z. B. `heft.innenumschlag`). Laut Kommentar in `src/heft/Heft.tsx` „ersetzt, nicht repariert".
- **`src/heft/*`** (Teil X, „Szenen-Maschine"/Hülle): `HeftRoute.tsx` ist die **eine** Komponente für alle Heft-Adressen; `Heft.tsx` rendert die aufgeschlagene `Doppelseite` (links/rechts als zwei Spalten, 1,44:1 breit / untereinander schmal), blättert per `navigate` (echte History), View Transitions, Register (`register.tsx`), Marken (`marken.tsx`), Satzspiegel (`satzspiegel.tsx`), Platten (`platte.tsx`).
  Routen (App.tsx, alle `<HeftRoute/>` lazy): `/` (Umschlag), `/inhalt`, `/kuratierter-raum`, `/drei-welten`, `/mode`, `/interior`, `/kunst`, `/haeuser`, `/deine-dna`, `/frag-pawn`, `/fuer-designer`, `/verzeichnis/:seite` (`/verzeichnis` → `/verzeichnis/1`), `/werk/:slug`, `/haus/:slug`, `/haus/:slug/:blatt`. Umzüge (301 in `vercel.json` + `Navigate` in App): `/heft`→`/`, `/heft/umschlag`→`/`, `/heft/:sektion`→`/:sektion`, `/shop`→`/verzeichnis/1`, `/product/:slug`→`/werk/:slug`, `/designer/:slug`→`/haus/:slug`. Kasse `/kasse` (`heft/kasse.tsx`, „Beileger", eigene Seite außerhalb der Hülle). Weiter existieren die Nicht-Heft-Seiten `/neu`, `/dna`, `/designers`, `/designers/all`, `/boutique`, `/cart`, `/checkout`, `/order/success`, `/account`, `/vision`, `/apply`, `/kontakt`, `/start`, `/einladung/:refCode`, Rechtstexte.
  Reihenfolge (`heft/spreads/index.tsx`): 01 Umschlag, 02 Inhalt, 03 Der kuratierte Raum, 04 Drei Welten, 05 Mode (Nacht), 06 Interior, 07 Kunst, 08 Unsere Häuser (Nacht), 09 Deine DNA, 10 Frag PAWN (Nacht), 11 Für Designer, 12+ Verzeichnis (12 Stücke je Doppelseite), dann je Werk eine Doppelseite, je Haus Auftakt + Baustein-Blätter. `Doppelseite = {schluessel, pfad, kolumne, titel, sektion, reiter?, ton: papier|nacht, links, rechts}`; `nummerFuerPfad`/`pfadFuerNummer` mappen Route ↔ Index.
  Daten: `useVerzeichnisWerke()` (products, s. 1.1; Filter über URL-Params `?welt=&preis=&haus=`, Preisbänder `bis-200|200-1000|ab-1000`), `useHausKapitel()` (designers + house_themes + designer_page_blocks + media_assets + products, s. 1.2–1.5). Werkseite: Korb via `useInDenKorb` (registriert DB-Stück im Core-Store, `commands.registerStueck` + `addToCart`), oder Anfragebogen → `createCustomRequestThread` (Login-Pflicht). Sektionstexte statisch im Code (aus alter Landing übernommen), `site_content` wird im X-Heft nicht gelesen.
  Wachen: `src/__tests__/routen.spec.ts` (App.tsx ↔ `routen.js`), `vercel-routen.spec.ts` (301-Ziele bekannt), `heft-adressen.spec.ts`, `src/heft/__tests__/werkseiten.spec.tsx`. Wer Routen ändert, muss `routen.js` **und** `vercel.json` pflegen (Middleware setzt 404 für unbekannte Pfade).
  Provider-Baum (App.tsx): `QueryClientProvider > TooltipProvider > BrowserRouter > I18nProvider > AuthProvider > AuthedCore(CoreProvider userId) > CartProvider > ConsentProvider > EditModeProvider > PersonalizationProvider > RoomShiftProvider > CopilotProvider > Routes`.

---

## 9. Lücken für ein Magazin-Frontend (Stil-Quiz, Begleiter-Chat mit Bild, kuratiertes Karussell, Doppelseiten je Haus)

**Quiz (Welt → Richtung → Form → Foto → Maße)**
1. Kein Speicherort für strukturierte Quiz-Antworten. `user_memory.preferences` ist ein frei beschreibbares JSON — nutzbar, aber ohne Schema, ohne INSERT-Recht für Kunden (Zeile entsteht nur serverseitig; ein Kunde ohne vorherigen pawn-chat-Turn hat **keine** Zeile und kann per Frontend nichts anlegen). Für Gäste gibt es gar keinen Serverspeicher — nur session/localStorage.
2. „Richtung"/„Form" (Stilachsen) haben kein Backend-Gegenstück: das Core-Genom (`structure|edge|…`) ist clientseitig und leer; `personalization` kennt nur `world`, `mood ∈ ruhig|spannung`, Tags. Produkte tragen keine Achsenwerte — `product_dna.mood/silhouette` sind freie Strings ohne Vokabular-Zwang (Vokabular nur indirekt via `fashion_ontology`).
3. „Foto" (Hautton/Unterton, Raumfoto): keine Edge Function, kein Prompt, kein Schema (s. 3.10). pawn-chat-Vision ist Mode-Moodboard-fixiert und braucht OpenAI-Key; Uploads landen in `style_references` (nur eingeloggt), Bucket `taste-uploads`. Für Gäste kein Upload-Pfad (Bucket-RLS für anon unbekannt/nicht im Auszug).
4. „Maße": `customer_measurements` deckt nur Mode-Körpermaße; keine Raummaße/Wandmaße für Interior/Kunst (nur `room_note` Freitext). Nur eingeloggt.
5. Quiz-Ergebnis → Produkte: keine serverseitige Matching-RPC; Scoring existiert nur im Client (`scoreForPersonalization`) und setzt eingeloggte `domain_events` voraus.

**Begleiter-Chat mit Bild**
6. Kein Streaming (JSON pro Turn), keine Tool/Function-Calls, keine strukturierte Antwortform außer `cards`/`action`. `cards.href` zeigt auf `/product/` (alte Adresse). Cards enthalten kein Bild/Preis.
7. Bilder müssen vorab in Storage hochgeladen und signiert werden (Frontend-Pflicht); ohne Login werden Bilder nicht als `style_references` gespeichert, und Gedächtnis (`user_memory`) gibt es nur eingeloggt. Bild-Deskriptor wird in `ai_sessions.extracted` gehalten — Client hat keinen Lesezugriff.
8. Kein Kontextfeld für Quiz-Ergebnis/Magazin-Seite außer `page_context.{route, product_slug}`; alles andere müsste als `messages[].content` mitgesendet werden (mit Persona-Verlust-Risiko).
9. Rate-Limit 40/min je IP — teilt sich zwischen allen Gästen hinter derselben IP.

**Kuratiertes Karussell**
10. `curated_collections/collection_items` existieren, aber nur eine aktive Collection, verknüpft über `product_slug` (nicht ID), ohne Bild/Text je Item, ohne Reihenfolge nach Haus, ohne Zeitsteuerung. Kein „featured"-Flag am Produkt (nur `designers.is_featured`).
11. Kein Produkt-Galeriemodell (ein `image_url`); mehrere Ansichten nur über `media_assets.product_id` (`kind='bild'`), die aber alle Zustände (`review_status='privat'`) anon lesbar ausliefern — ein Karussell müsste selbst filtern.
12. Kein serverseitiges Bild-Preset (nur `/render/image/` Transformation); keine Fokuspunkt-/Ausschnittdaten.

**Doppelseite je Haus**
13. Bausteine (`designer_page_blocks`) sind eine lineare Liste ohne Seiten-/Spread-Semantik; Zuordnung Baustein → linke/rechte Seite muss das Frontend erfinden (so macht es `heft/haeuser.tsx: bausteinInhalt`). Nur sichtbar, wenn `page_published_at` gesetzt.
14. Haus-Texte: `story`, `quote`, `manifesto`, `collection_title` — kein Mehrsprachigkeitsfeld (nur `preferred_language`), keine Übersetzung in DB; `site_content.value_en` gilt nur für Plattformtexte.
15. `house_themes` liefert Farben/Typo/Rhythmus, ist aber nur für veröffentlichte Hausseiten lesbar; Häuser ohne Theme fallen auf PAWN-Standard zurück. Der `archetyp` steckt in `brand_dna` (JSON).
16. `designers`-Public-Policy exponiert Stripe-Spalten an anon — kein View mit Spaltenmaske; ein neues Frontend sollte streng selektieren.

**Querschnitt**
17. Gäste haben keinen Server-Zustand: Warenkorb, Sitzungsspur, Quiz und Consent leben im Browser. Merge beim Login existiert nur für die Chat-Session (`merge_anon_session`).
18. `domain_events` sind für anon gesperrt; Insert verlangt `identity_scope = auth.uid()`, pawn-chat schreibt aber ohne `identity_scope` → Lesbarkeit der Chat-Signale durch den Kunden hängt an einer Policy, die im Auszug fehlt (Risiko).
19. `types.ts` veraltet (fehlende `kauf_freigeschaltet`, `first_move_sessions`, `first_move_publish`); vor Bau `mcp__Supabase__generate_typescript_types` gegen das Live-Projekt laufen lassen.
20. Edge-Function-Änderungen (neuer Chat-Mode, Foto-Analyse) sind nur per Lovable-Deploy möglich (CLAUDE.md), Secrets (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `STRIPE_*`, `RESEND_API_KEY`, `LOVABLE_API_KEY`) liegen dort.
21. Routing-Vertrag: neue Adressen brauchen Einträge in `App.tsx`, `routen.js` und `vercel.json`, sonst 404 durch Middleware; `/heft*` ist bereits als 301 auf `/` belegt.
