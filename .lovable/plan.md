
# PAWN — Frontend Evolution v1

Goal: one design language across public, customer, designer, admin. Fix primitives first, then migrate pages. Zero changes to routing, state, or business logic.

## Phase 1 — Audit & language lock (no code yet mentally, first commits are tokens)

Audit sweep across `src/pages/**`, `src/components/pawn/**`, admin/portal shells. Catalogue every ad-hoc:
- card / panel / bordered box variant
- KPI / stat display
- section header / eyebrow / chapter label
- button + link treatment
- table / list row
- empty & loading state
- explanation / tooltip / rationale block
- badge / pill / tag
- divider / hairline / chess seam

Outcome: a written primitive map (in `src/docs/DESIGN_LANGUAGE.md`) naming each primitive, its rules, and every current offender to replace.

## Phase 2 — Token & rule hardening (`src/index.css`, `tailwind.config.ts`)

Lock the language before touching components:
- Type scale: 4 display sizes (Playfair) + 3 body sizes (Inter) + eyebrow. Named utilities: `.t-display-xl/lg/md/sm`, `.t-body-lg/md/sm`, `.t-eyebrow`, `.t-numeral`. No other font sizes allowed in pages.
- Spacing rhythm: 4 / 8 / 16 / 24 / 40 / 64 / 96. Section vertical padding standardized (`.section-y`).
- Surface hierarchy: `paper` (editorial silence) → `ivory` (commerce body) → `bone` (secondary panel) → `ink` (control/admin). Codify allowed nesting.
- Border language: only `hairline` (1px `--border`) and `hairline-strong`. No shadows on public; single `--shadow-editorial` reserved for overlays.
- Color semantics: oxblood = decision only; gold = rare accolade accent (new token `--gold: 40 35% 55%`); ink = authority; ivory/paper = calm.
- Motion: one easing (`cubic-bezier(.2,.7,.2,1)`), two durations (180ms micro, 520ms reveal). Utility `.motion-reveal`, `.motion-hover`.
- Radius: 0 everywhere (already). Enforce by removing rounded-* from primitives.

## Phase 3 — Primitive library (`src/components/pawn/primitives/`)

Extract 11 primitives. Each ships with variants + stories in `src/docs/DESIGN_LANGUAGE.md`.

```text
Panel            surface container: variants paper|ivory|bone|ink, padding sm|md|lg, optional eyebrow+title+action slot
SectionHeader    eyebrow · numeral · title · description · trailing action; one grammar for every page
Metric           label · value (numeral) · delta · rationale tooltip; replaces StatCard + inline KPIs
Timeline         vertical event stream (used by Activity, Provenance, Mutation Path)
Activity         event row (actor · verb · object · time · dna tag)
Insight          reasoning card: cause → effect → confidence; replaces ad-hoc "why"
Recommendation   subject · rationale · action; used by Shop, Cockpit, Portal
Command          decision affordance (oxblood pill or ink button); replaces mixed CTAs
Status           dot + label + tone (live|watch|risk|calm)
DnaBadge         already exists — normalize sizes, unify rationale slot
IdentityChip     avatar/mono glyph + name + role
```

Also standardize:
- `Button` variants pruned to: `ink` (primary), `paper` (secondary), `ghost`, `decision` (oxblood, single-per-view rule documented). Remove default shadcn blues.
- `Hairline`, `ChessSeam`, `ChapterLabel` consolidated under `primitives/`.

## Phase 4 — Shell unification

- `PublicLayout`, `AdminShell`, `PortalShell` share a single `Shell` grammar: sticky utility bar, main header, section grid (12-col, 40px gutters desktop, 16 mobile), footer/hairline. Sidebars become `NavRail` primitive with identical typographic rhythm in ink vs ivory.
- One `PageHeader` (eyebrow · numeral · h1 · lede · action) used by every route.

## Phase 5 — Page migration (presentation only)

Route-by-route, replace local implementations with primitives. No logic changes.

1. Home (`Index.tsx`) — SectionHeader + Panel + Recommendation
2. DNA — Panel(paper) + Metric + Timeline (Mutation Path) + Insight
3. Shop — SectionHeader + filter rail as Panel(bone) + ProductCard already primitive; align spacing/typography
4. Product Detail — PageHeader + Panel + Insight (DNA match) + Command
5. Designers / DesignerPage — PageHeader + IdentityChip + Metric + Recommendation
6. Cart / Checkout — Panel + Metric (totals) + Command (oxblood, single)
7. Account — PageHeader + Timeline (order/activity) + Metric + Insight
8. Portal (Overview, Editor, others) — Shell + Panel + Metric + Activity + Recommendation
9. Admin (Overview, DNA, AI, Products) — Shell(ink) + Metric + Timeline + Insight + Command; Cockpit reasoning already fits Insight
10. Auth / Apply / NotFound — PageHeader + Panel

Each page PR removes: local card divs, ad-hoc borders, inline font sizes, stray colors, rogue rounded corners.

## Phase 6 — Cleanup & guardrails

- Delete unused old components once no references remain (`StatCard` → alias to `Metric` for one release, then remove).
- Add ESLint rule / doc note forbidding raw `text-white`, `bg-black`, hex literals, arbitrary `text-[..]` sizes in `src/pages` and `src/components/pawn` (documented; lint rule optional).
- Vitest snapshot on primitives; visual smoke via existing Playwright to confirm no route regressions.
- Update `src/docs/DESIGN_LANGUAGE.md` with the final map and "how to add a new screen" checklist.

## Out of scope

Routing, domain core, Supabase, commands, selectors, auth. No new features. Presentation layer only.

## Deliverables

1. `DESIGN_LANGUAGE.md` — tokens, primitives, rules, offender list.
2. Token hardening in `index.css` + `tailwind.config.ts`.
3. `src/components/pawn/primitives/` library (11 primitives + shell parts).
4. Every page under `src/pages/**` migrated to primitives.
5. Summary at end: primitives introduced, inconsistencies removed, future screens that inherit the language automatically.

## Risks

- Large surface area — mitigated by phasing: tokens → primitives → pages, each independently verifiable.
- Silent visual drift on migration — mitigated by keeping ProductCard/DnaBadge visual identity intact and diffing screenshots per route.
- Temporary duplication while old + new coexist — bounded to one phase; removals happen in Phase 6.
