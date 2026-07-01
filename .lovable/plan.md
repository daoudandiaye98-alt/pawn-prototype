# PAWN — Coherence Pass v1
"One organism, three nervous-system projections."

---

## Part A — Architectural Audit

Classification: 🟢 production-ready · 🟡 prototype-real (works end-to-end, needs hardening) · 🟠 simulated (UI only) · 🔴 missing.

### A1. Event backbone
| Area | State | Notes |
|---|---|---|
| `src/core` event log + reducers + selectors | 🟢 | Deterministic, tested (30 specs), snapshot/compaction ready. |
| `domain_events` table + RLS | 🟡 | Persists events for signed-in users; only `order.placed` currently whitelisted. |
| Local↔remote hydration | 🟡 | Replays remote on top of local; no conflict strategy, no realtime. |
| Public/customer events (view, save, follow, stylist, dna.open) | 🔴 | Fired nowhere — biggest gap. |
| Designer publish/edit events | 🔴 | Portal is read-only mocks. |
| OS causal chains → real events | 🟠 | `systemBus` is a UI-only fan-out. Not written to `domain_events`. |

### A2. DNA layer
| Surface | State |
|---|---|
| `/dna` dossier | 🟡 real selectors |
| Product Card DNA match | 🔴 |
| Product Detail "why this fits" | 🔴 |
| Designer page alignment | 🔴 |
| Shop filter by DNA direction | 🔴 |
| Cart wardrobe impact | 🔴 |
| Account DNA history | 🔴 |
| Designer audience clusters | 🟠 (static) |
| Admin global cluster shifts | 🟠 (static) |

No shared `dnaMatch(identity, product)` selector exists yet — every surface would reinvent it.

### A3. Role security
| Control | State |
|---|---|
| Frontend `RoleGate` | 🟡 prototype pass-through when signed-out |
| `has_role()` SQL function | 🟢 |
| `user_roles` RLS | 🟢 |
| `domain_events` RLS restricts write to own `user_id` | 🟡 verify `event_type` allow-list |
| Admin-only event guard (server-side) | 🔴 no check that only admins emit `designer.approve`, `prompt.deploy`, etc. |
| Designer isolation on writes | 🔴 no `designer_id` scoping on future product tables |
| Customer isolation on reads | 🟢 for `profiles`, 🟡 for events |

### A4. Surfaces
| Surface | Projection quality |
|---|---|
| Customer Account | Orders-centric, not identity-centric. |
| Designer Studio | Rich UI, zero writes, no audience-cluster selector. |
| Admin Command Deck | Strong; missing "one decision today" primary layer. |
| Public site | Disconnected from event log. |

### A5. Highest-risk simulated parts (fix first)
1. Customer interactions never touch the event log → the "living system" claim is false.
2. Server-side event allow-list per role is missing → any client could persist `designer.approve`.
3. DNA is a page, not a layer → no shared selector.
4. `systemBus` chains are pure UI theatre → must be seeded by real events (own or subscribed).

---

## Part B — Execution Plan (7 vertical slices)

Each slice is shippable, testable, and preserves the visual language. No visual redesign; only additions consistent with the ivory/ink/oxblood moodboard.

### Slice 1 — Role security & event boundaries (foundation)
- Extend `domain_events` schema: `role_required` allow-list enforced by a `BEFORE INSERT` trigger + `has_role()`.
- Whitelist per event_type:
  - customer: `product.viewed|saved|unsaved`, `designer.followed|unfollowed`, `dna.opened`, `stylist.used`, `cart.*`, `order.placed`, `mutation.proposed`.
  - designer: `product.drafted|published|updated`, `collection.*`, `payout.requested`.
  - admin: `designer.approved|rejected`, `prompt.deployed|rolledback`, `policy.updated`, `plugin.enabled`, `broadcast.sent`, `mutation.ratified`.
- Harden `RoleGate` so signed-in users without a role can't read admin/portal surfaces; keep anonymous prototype banner.
- Tests: RLS reject matrix.

### Slice 2 — Event flow unification (customer)
- New file `src/core/events/customer.ts` exposing `emitProductViewed`, `emitProductSaved`, `emitDesignerFollowed`, `emitDnaOpened`, `emitStylistUsed`, `emitMutationProposed`.
- Wire into `ProductCard` (view on intersection, save on click), `ProductDetail`, `DesignerPage`, `DNA` page open, `Cart`, `Checkout`, `Stylist` CTA.
- Reducer updates: identity `savedCount`, `followsCount`, `dna.mutations` (proposed).
- Persisted via existing supabase adapter (extend whitelist).

### Slice 3 — DNA as a layer
- New selector `src/core/selectors/dna.ts`:
  - `dnaMatch(state, identityId, productId): { score: 0..1, topAxes, rationale[] }`
  - `dnaAlignment(state, identityId, designerId)`
  - `wardrobeImpact(state, identityId, cart)`
- New component `DnaBadge` (ivory ring + % + tooltip w/ rationale).
- Integrate into ProductCard, ProductDetail ("Warum es passt"), DesignerPage, Cart summary, Shop filter chip ("Light / Shadow / Structure / Edge").
- Selector is pure; UI reuses same rationale everywhere → coherence.

### Slice 4 — Customer Identity Archive
- Restructure `Account.tsx` into tabs, DNA-first:
  1. Identity Timeline (from event log, own events)
  2. DNA History (mutations + version diffs)
  3. Saved Signals (products saved + why)
  4. Wardrobe Map (chess-grid of saved items by axis)
  5. Designer Affinity
  6. Recommendation Reasons
  7. Privacy (Freeze DNA · Export DNA JSON · Delete)
  8. Secondary: Orders · Wishlist · Addresses · Payment
- New selectors `getIdentityTimeline`, `getDnaHistory`, `getDesignerAffinity`.
- "Freeze DNA" emits `dna.frozen` → dnaEvolution policy skips proposals.

### Slice 5 — Designer Studio Intelligence
- Studio-scoped selectors in `src/core/selectors/portal.ts`:
  - `getAudienceClusters(designerId)` — aggregates identities whose dossier top-axes overlap w/ designer's products.
  - `getProductOpportunities(designerId)` — axis gaps vs demand.
  - `getRankingExplanations(productId)`.
  - `getFulfillmentQueue(designerId)`, `getPayoutStatus(designerId)`.
- Guard: selectors reject if `designerId !== session.designerId`.
- No admin surfaces linked from Studio.

### Slice 6 — Admin Decision Layer
- New selector `getPrimaryDecision(state): Decision` returning `{observation, cause, impact, risk, recommended, alternatives[], expected}`.
- New panel `PrimaryDecisionCard` at top of `AdminOverview`, above KPIs.
- Buttons call `useCommand` → real domain events (which then fan out into `systemBus` — bus becomes a *view* of real events, not the source).
- Decision generator uses simple rules over recent events (revenue delta, inventory risk, cluster migration).

### Slice 7 — Bus becomes projection, not source
- Refactor `systemBus`: subscribe to `useDomainEvents()` and derive `feed`/`engines` from real events + a small "expected downstream" map.
- Remove synthetic `fire()` demo button; keep for admin QA behind `?debug=1`.
- All three surfaces now consume the same event stream, projected differently.

---

## Part C — Ordering & risk

Order matches priority: 1 → 7. Slice 1 must ship first (security). Slices 2 and 3 unlock the "DNA everywhere" and "living system" claims. Slices 4–6 are surface projections built on the same substrate. Slice 7 flips the causality direction so no surface lies.

Rollback: each slice is independent; feature-flag `VITE_PAWN_EVENTS_V2` gates client emits during Slice 2 rollout.

## Part D — Non-goals
- No visual redesign.
- No new routes.
- No new pages beyond restructured Account tabs.
- No AI provider swap.
- No plugin runtime work.

---

Approve to start Slice 1 (role security + event allow-list trigger + RLS reject tests). I'll ship slices sequentially with typecheck + targeted tests between each.
