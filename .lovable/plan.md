
# PAWN Refinement Pass v2 — Updated Plan

Accepted: Creative Director refinement continues. Extended with chess polarity, DNA-as-identity-dossier, expanded AI Control Panel, and a documented backend/plugin roadmap. Nothing is amputated — Shop, Product, Designer, Apply, Account, Admin, Portal all stay.

---

## 1. Foundation — Chess Polarity Tokens

`src/index.css` + `tailwind.config.ts`:
- Add explicit tokens: `--ivory` (body/commerce), `--paper` pure white (editorial silence), `--ink` near-pure black `#0A0807` (control/intelligence), `--oxblood` (rare decision accent — used sparingly, never as fill block).
- New utility classes: `.chess-grid` (4–8px checker SVG), `.hairline` (continuous 1px rule that bleeds section→section), `.ink-panel`, `.paper-panel`, `.ivory-panel`, `.bone-panel`.
- Motion: shared easing token + fade-up-on-scroll util. No decorative motion; motion communicates state only.

Rules enforced project-wide:
- Oxblood appears max once per viewport.
- Every page alternates contrast: ivory → ink → bone → paper → ivory.
- Section boundaries use hairlines or pawn-glyph dividers, never empty gutters.

## 2. Shared Components

Refine existing, add three new:
- `ChessDivider` — pawn glyph centered on a hairline that continues left/right.
- `ChapterLabel` — recurring "CHAPTER 0X — TITLE" rhythm element used on every long page.
- `InkPanel` / `PaperPanel` wrappers — enforce the inverted-contrast sections inside ivory pages.

Existing `PawnMark`, `DNAVisual`, `DNARing`, `PageLabel`, `ProductCard`, `ProductImage` get a contrast/spacing tightening pass — no rebuilds.

## 3. Signature Motifs

- `PawnMark` — used as structural divider, not just logo.
- `DNAHelix` — upgraded SVG, becomes the DNA page's spine.
- `ChessGrid` — micro checker pattern as texture in ink panels and footer.
- `LightShadowDivider` — vertical ivory/ink split used on Home + section transitions.

## 4. Home + DNA (priority pages)

**Home (`Index.tsx`)** — keep Light/Shadow hero, tighten to true paper-vs-ink split, add ChessDivider between sections, add an ink-panel "Intelligence" band introducing PAWN AI, end on ivory commerce band leading into Shop.

**DNA (`DNA.tsx`)** — full rebuild as **Identity Dossier**, not score dashboard:
1. Opening: "YOUR DNA. YOUR CODE." (paper)
2. AI input: "Ask PAWN anything" (ink panel, oxblood submit)
3. DNA Score 87 / Very Distinct + Helix (ivory, helix as spine)
4. **Style Genome** — six bars: Structure, Edge, Elegance, Darkness, Sensuality, Utility (bone panel, editorial bar chart, not radar)
5. **Mutation Path** — three columns: Current Style → Suppressed Style → Next Evolution (ink panel, white type)
6. Inspired by you (product triptych)
7. Designers aligned with your DNA (designer triptych)
8. Pieces that mutate your wardrobe
9. Full DNA Report CTA (oxblood, single decision moment)

Reads top-to-bottom like a psychological fashion dossier; chapter labels 01–09 enforce rhythm.

## 5. Designers Landing + Apply

Tighten existing pages — add ink-panel testimonial/stat band, ChessDivider rhythm, hairline continuity. Apply flow gets clearer chapter numbering across the 4 steps.

## 6. Shop + Product Detail

- Shop: paper background, ink filter rail, chess-grid hover state on cards.
- Product Detail: split-screen (ivory image / ink spec column), oxblood Add-to-Cart as the page's single decision.

## 7. Cart, Checkout, Account

Tightened typography, hairline continuity, chess-grid empty states. No structural changes.

## 8. Admin Visual Refinement

All admin pages move onto true `--ink` surface with paper hairlines and ivory data accents. Oxblood reserved for destructive/decision actions.

## 9. Admin AI — Expanded into AI Control Panel

`/admin/ai` becomes a multi-panel control surface (mock UI, architected for real backend). Left rail navigates panels:

- **Playground** (current chat, kept)
- **Model Settings** — provider, model, temperature, max tokens, top-p
- **System Prompt** — editable master prompt with version indicator
- **Personality & Tone** — role selector: Stylist / Analyst / Curator / Support / Admin Assistant + tone sliders
- **Knowledge Sources** — list of attached docs/URLs/collections, toggle per source
- **Tools / Plugins** — toggle list (see §11)
- **Safety Rules** — content rules, forbidden topics, escalation
- **Response Style** — length, formatting, citation behavior
- **Memory Rules** — what AI may remember per user/session
- **Version History** — diff between prompt/config versions
- **Logs** (read-only mock) — recent AI calls, tokens, latency

All forms wired to local state only — no backend yet, but typed so the Supabase schema in §10 drops in cleanly.

## 10. Backend Architecture Plan (documented, not built)

Add `src/docs/BACKEND.md` (and matching header comments in admin pages) describing the future Supabase schema:

`profiles, roles, designers, brands, designer_applications, products, collections, product_images, orders, order_items, dna_profiles, dna_reports, ai_settings, ai_prompts, ai_knowledge_sources, ai_tools, ai_logs, plugin_connections, admin_audit_logs`

Plus: RLS strategy (separate `user_roles` table + `has_role` security-definer per platform guidance), Edge Function boundaries for AI calls via Lovable AI Gateway, audit-log discipline for every admin mutation. **No tables are created in this pass.**

## 11. Plugin System Concept (mock UI only)

Inside Admin AI → Tools/Plugins, render a catalog of connector cards (all disabled mock state):
- OpenAI / Anthropic models
- Image generation
- Email
- Analytics
- Stripe
- Shipping
- CMS / content sources
- Fashion trend APIs
- Social media imports

Each card: name, description, "Connect" button (disabled, tooltip "Available with backend"). Architecture ready for real `plugin_connections` table later.

## 12. Designer Portal + Editor

Visual tightening to match admin ink system, hairline continuity, oxblood reserved for publish/payout decision moments. No new features.

## 13. Final Route Walkthrough

Headless Playwright pass across all 16 routes capturing screenshots at mobile + desktop to verify:
- Chess polarity visible on every page
- Hairlines flow section-to-section
- Oxblood used max once per viewport
- DNA page reads as dossier
- Admin AI shows all 11 control panels
- No empty/broken states

---

## Quality Checklist (run before finishing)

- [ ] Feels like PAWN, not Loewe/Aesop
- [ ] Chess polarity (ivory / paper / ink / oxblood) visible on every page
- [ ] DNA page functions as identity architecture, not a dashboard
- [ ] Admin AI panels cover model, prompt, knowledge, tools, personality, safety, style, memory, playground, versions, logs
- [ ] Pages flow as editorial dossier — every section answers the previous
- [ ] Marketplace structure intact: Shop, Product, Designer, Apply, Account, Admin, Portal all present
- [ ] Backend roadmap documented in `src/docs/BACKEND.md`
- [ ] Plugin catalog visible as mock UI

---

## Out of scope this pass

- Real Supabase tables / RLS
- Real AI model calls
- Real plugin integrations
- New feature surfaces beyond what's listed

Approve to execute in the order above (1 → 13).
