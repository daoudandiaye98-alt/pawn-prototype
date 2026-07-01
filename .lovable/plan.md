
# PAWN — Core Migration Plan v1

Goal: pages stop importing `@/data/mock` and instead read via `useStore(selector)` + `useCommand()` from `src/core`. No visual changes, no new features, no route changes. The `mock.ts` shim stays alive until the final phase, then is deleted.

## Ground rules (apply to every phase)

- One page (or one small cluster) per PR-sized step. Ship, verify, then continue.
- Legacy denormalized shapes (`Product`, `Designer`, `Order` in `mock.ts`) stay untouched until the last phase. New selectors return **core entities** — pages adapt at the call site with tiny local `toView(entity)` mappers when a component still expects the legacy shape.
- Every migrated page: typecheck clean, prod build clean, route renders, DOM diff visually unchanged.
- No selector may return a freshly-allocated object/array on each call unless memoised (see Selector Identity Stability).

## Selector identity stability rules

Enforced by convention + a lint-style checklist in `src/core/README.md`:

1. Selectors that return a **primitive**, a **stored reference**, or `undefined` — safe.
2. Selectors that derive a new object/array — must either:
   - use a module-level `WeakMap<DomainState, Result>` cache keyed by state, or
   - use a small keyed cache (as `getCart` does with `emptyCartCache`), or
   - be composed at the component boundary with `useMemo(() => derive(x), [x])`.
3. Aggregate selectors that fan out (`getRecommendedProducts`, `getAlignedDesigners`) get a `WeakMap<DomainState, Map<IdentityId, Result>>` memo.
4. Rule of thumb baked into every new selector file header: "same state in → same reference out."

## localStorage event log compaction

Current risk: append-only log in `localStorage` grows without bound.

Strategy (design only, implemented in a later step, no behaviour change now):

- Threshold: when log length exceeds `COMPACTION_THRESHOLD = 500` events **or** serialised size > 256 KB, run a compaction pass on next `emit`.
- Compaction = fold all events into current `DomainState`, then rewrite the log as a **single `SnapshotRestored` genesis event** carrying the snapshot payload, followed by any events that arrived during the fold.
- Snapshot schema versioned: `{ v: 1, state, at }`. Version mismatch on load ⇒ discard snapshot, replay from seed genesis.
- Separate keys: `pawn.core.log.v1` (events) + `pawn.core.snapshot.v1` (snapshot). Snapshot loaded first, then log replayed on top.
- Feature flag `CORE_COMPACTION_ENABLED = false` until we have vitest coverage of the fold/restore round-trip.

## Minimum vitest coverage before touching pages

Add `src/core/__tests__/` with the following before Phase 2:

1. `reducers/identity.spec.ts` — DNA evolution: axis clamp `[0..100]`, damping factor, mutation history append.
2. `reducers/marketplace.spec.ts` — cart add / remove / qty change / clear; product/designer registration idempotency.
3. `reducers/aiGovernance.spec.ts` — prompt version bump, plugin enable/disable.
4. `commands/index.spec.ts` — command → event → reducer round-trip; rejection paths return `CommandResult.error` without emitting.
5. `events/log.spec.ts` — append preserves order; subscribers fire once per emit; unsubscribe works.
6. `selectors/marketplace.spec.ts` — `getCart` returns stable ref for empty carts; `getRecommendedProducts` memoised per `(state, identityId)`.
7. `seed/index.spec.ts` — hydrated state matches legacy `mock.ts` shim shape (guards the compat contract).

Target: ≥ 80 % line coverage on `src/core/{reducers,commands,selectors,policies}`. CI budget: < 2 s.

## Provenance surfacing (design only, no UI yet)

- Every `Recommendation` already carries `{ reason, sourceEventIds[], affectedAxes[] }` from `buildRecommendations`.
- Add `getProvenanceTrace(state, recommendationId)` returning `{ recommendation, events, genomeSnapshotBefore, genomeSnapshotAfter }`.
- UI hook later (out of scope now): `<ProvenanceTooltip recommendationId>` that opens on hover of any product card fed by a recommendation. No visual change in this migration — just make sure every migrated page that reads `getRecommendedProducts` keeps the `Recommendation.id` on the rendered element as `data-recommendation-id`, so the tooltip can attach later without another refactor.

---

## Execution order (9 phases, risk labelled)

### Phase 1 — Cart  ·  Risk: **Very Low**
Already core-backed via `useCart` adapter. This phase promotes the page to use selectors/commands directly and removes the adapter's public surface leakage.

- Current mock imports: none directly; goes through `src/store/cart.tsx`.
- Replacement selectors: `marketplaceSelectors.getCart`, `marketplaceSelectors.getAllProducts` (to resolve line → product).
- Replacement commands: `commands.addToCart`, `commands.removeCartLine`, `commands.updateCartLineQty`, `commands.clearCart`.
- Keep `useCart` as a 5-line convenience hook (`return { cart, add, remove, ... }`) so `Checkout.tsx` and header badge don't churn.
- Expected UI: identical. Same line items, same totals, same toast on add.
- Regression risk: cart badge count in header; verify `getCart(...).lines.length` matches previous `items.length`.
- Files touched: `src/pages/Cart.tsx`, `src/store/cart.tsx` (thin rewrite), `src/components/pawn/PublicHeader.tsx` (if it reads cart count).
- Acceptance: add → remove → clear round-trip works; `localStorage` events append; refresh preserves cart; typecheck + build clean.

### Phase 2 — Shop grid  ·  Risk: **Low**
- Current mock imports: `import { products } from "@/data/mock"`.
- Replacement: `useStore(marketplaceSelectors.getAllProducts)` + local `useMemo` to build the legacy view shape (`designer`, `designerSlug`) via `getDesignerById`.
- Commands: none (read-only).
- UI: identical grid, identical filters. Filter chips remain a local `useState`.
- Regression risk: `ProductCard` currently expects `Product` from `mock.ts` — introduce `toProductView(product, designer)` helper in `src/core/views/product.ts` used by Shop, ProductDetail, DesignerPage, Portal, DNA. Card component signature unchanged.
- Files touched: `src/pages/Shop.tsx`, new `src/core/views/product.ts`.
- Acceptance: same product count, same order, filters unchanged.

### Phase 3 — Product Detail  ·  Risk: **Low**
- Current mock imports: `productBySlug`, `products`.
- Replacement selectors: `marketplaceSelectors.getProductBySlug`, `marketplaceSelectors.getRecommendedProducts` (for "You may also like" — currently a random slice; migration also silently upgrades it to provenance-aware without visual change since the section already renders 4 cards).
- Commands: `commands.addToCart` (already via `useCart`).
- Regression risk: URL not-found path — selector returns `undefined`, keep existing 404 branch.
- Files touched: `src/pages/ProductDetail.tsx`, uses `toProductView`.
- Acceptance: slug lookup works; add-to-cart still fires; related products count unchanged; `data-recommendation-id` attribute added to related cards (invisible).

### Phase 4 — DNA page  ·  Risk: **Medium**
- Current mock imports: `products`, `designers` (used for "aligned" preview).
- Replacement selectors: `selectors.getIdentityDossier`, `selectors.getStyleGenome`, `selectors.getMutationPath`, `marketplaceSelectors.getAlignedDesigners`, `marketplaceSelectors.getRecommendedProducts`.
- Commands: `commands.applyDnaMutation` (already used by AI prompt input — verify wiring, do not change UX).
- UI: identical 9 chapters. Genome bars now driven by `getStyleGenome` instead of a static array; provided seed produces identical numbers by construction.
- Regression risk: bar order — enforce a canonical `GenomeAxis[]` export from `types/entities` so display order is stable.
- Files touched: `src/pages/DNA.tsx`, `src/core/types/entities.ts` (add exported `GENOME_AXES` const array).
- Acceptance: chapters render, values match previous static values within ±0 (seeded), mutation history list identical.

### Phase 5 — Designer public page  ·  Risk: **Low**
- Current mock imports: `designerBySlug`, `products` (filtered by designer).
- Replacement selectors: `marketplaceSelectors.getDesignerBySlug`, new `marketplaceSelectors.getProductsByDesignerId(state, designerId)` (add with memo).
- Regression risk: none — pure read migration.
- Files touched: `src/pages/DesignerPage.tsx`, `src/core/selectors/marketplace.ts` (+1 memoised selector).
- Acceptance: designer bio, product list, counts unchanged.

### Phase 6 — Account  ·  Risk: **Low**
- Current mock imports: `customerOrders`.
- Replacement selectors: new `selectors.getCustomerOrders(state, identityId)` sourcing from `state.marketplace.orders` filtered by identity. Seed already contains these orders; selector wraps.
- Regression risk: order status/date formatting — keep local formatter untouched.
- Files touched: `src/pages/Account.tsx`, `src/core/selectors/identity.ts`.
- Acceptance: same orders, same order.

### Phase 7 — Admin Overview  ·  Risk: **Medium**
- Current mock imports: `adminOrders`, `revenueSeries`, `monthsShort`.
- Replacement selectors: `adminSelectors.getPlatformOverview(state)` returning `{ orders, revenueSeries, months, kpis }`. This is a compound selector — must be memoised via `WeakMap<DomainState, PlatformOverview>`.
- Regression risk: chart data identity — recharts re-renders if the array reference changes; memoisation is mandatory here.
- Files touched: `src/pages/admin/AdminOverview.tsx`, `src/core/selectors/admin.ts`.
- Acceptance: chart draws identically, order table rows match.

### Phase 8 — Admin AI Control Panel  ·  Risk: **Medium**
- Current mock imports: none direct (already isolated), but state is component-local. Migrate to core so future events are auditable.
- Replacement selectors: `aiSelectors.getModelSettings`, `getSystemPrompt`, `getKnowledgeSources`, `getPluginCatalog`, `getPolicyMatrix` (add stubs where missing).
- Replacement commands: `commands.updateModelSettings`, `commands.publishSystemPromptVersion`, `commands.togglePlugin`, `commands.updatePolicy`. All already exist in seed reducers; wire the panels' local state → commands.
- Regression risk: 11 panels × form state — migrate panel-by-panel (sub-steps 8.1 … 8.11), commit after each.
- Files touched: `src/pages/admin/AdminAI.tsx` (split into subcomponents `src/pages/admin/ai/*.tsx` if it grows > 400 lines — otherwise leave as-is).
- Acceptance: every toggle/save persists across refresh (proves event log wiring), no visual change.

### Phase 9 — Designer Portal  ·  Risk: **Medium**
- Current mock imports (PortalOverview): `adminOrders`, `revenueSeries`, `monthsShort`, `products`.
- Replacement selectors: `portalSelectors.getStudioOverview(state, designerId)` returning `{ orders, revenueSeries, months, products, payoutStatus }`, memoised per designer id.
- Commands: none for overview; `commands.updateDesignerProfile` for `PortalEditor` (already wired via a local mock — swap).
- Regression risk: revenue data is currently global — scope it to designer via seed events; ensure numbers still look plausible (they can differ slightly; acceptable since values were placeholder).
- Files touched: `src/pages/portal/PortalOverview.tsx`, `src/pages/portal/PortalEditor.tsx`, `src/core/selectors/portal.ts`.
- Acceptance: page renders, editor save round-trips through event log.

### Phase 10 (finalisation) — Delete the shim  ·  Risk: **Low if 1–9 green**
- Delete `src/data/mock.ts`.
- Delete legacy interfaces in favour of `Product`/`Designer` from `src/core/types/entities.ts`.
- Ripgrep must return zero matches for `@/data/mock`.
- Files touched: removal only.
- Acceptance: build + typecheck green; all 16 routes render; cart, DNA, admin AI persistence intact.

---

## Cross-cutting risks

| Risk | Mitigation |
|---|---|
| `useSyncExternalStore` re-render storms from unstable selector refs | Selector Identity Stability rules + `WeakMap` memos; enforced by unit test that calls each selector twice with same state and asserts `===`. |
| Event log growth in `localStorage` during a long session | Compaction design shipped in the same milestone as vitest coverage (before Phase 7). |
| Recharts / shadcn components re-mounting on selector churn | Every admin/portal compound selector is memoised; verified by rendering the page and asserting stable child keys. |
| Migration touches many files — merge risk | 10 phases, each self-contained, each with build + typecheck gate; no phase depends on the next except through selectors it already added. |
| Silent behaviour drift in recommendations | Snapshot test: `getRecommendedProducts(seedState, meId)` asserted against a committed JSON fixture. |
| Provenance metadata attached to DOM but unused | Only `data-*` attributes, zero visual impact, zero bundle cost until the tooltip lands. |

## Technical appendix

- New files:
  - `src/core/views/product.ts` — `toProductView(product, designer): ProductView`
  - `src/core/__tests__/*.spec.ts` — reducer/command/selector/log coverage
  - `src/core/adapters/compaction.ts` — snapshot + replay (behind flag)
- Extended selector files:
  - `selectors/marketplace.ts` — `getProductsByDesignerId`
  - `selectors/identity.ts` — `getCustomerOrders`
  - `selectors/admin.ts` — `getPlatformOverview`
  - `selectors/portal.ts` — `getStudioOverview`
  - `selectors/ai.ts` — panel-specific selectors for the 11 sections
  - `selectors/provenance.ts` — `getProvenanceTrace`
- No changes to: routes, `App.tsx`, shadcn components, Tailwind tokens, page-level markup, `CartProvider` public API.

## Definition of done

- `rg "@/data/mock" src` → 0 results.
- `bun run build` + `bunx tsgo --noEmit` → clean.
- `bunx vitest run` → all core tests green.
- All 16 routes render with no visible diff vs. pre-migration screenshots (spot-check Home, Shop, DNA, Admin AI, Portal Overview).
- Cart, AI Control Panel toggles, and Designer Editor edits survive a hard refresh (proves the event log is the source of truth).
