
# PAWN — `src/core/` Implementation Plan (Item 1)

Introduce the missing middle. No visible product changes, no backend, no real AI. When merged: every page still renders identically, but domain meaning has moved out of `mock.ts` and page components into a framework-free core that a future Supabase adapter can drop behind.

---

## 0. Guiding rules

- **Framework-free.** `src/core/` never imports React, Vite, or Tailwind.
- **Pure by default.** Reducers, selectors, policies are pure functions of `(state, event)` or `(state)`.
- **Events are the only writer.** Commands produce events; reducers fold events; selectors read state. No component mutates domain state directly.
- **Backward compatible.** `src/data/mock.ts` continues to re-export shapes so existing pages keep compiling during migration. It becomes a thin adapter over `core/seed.ts`.
- **No visual regressions.** Migration is behind-the-scenes. The only React-facing addition is a `CoreProvider` and typed hooks that mirror what pages already consume.

---

## 1. Directory layout

```text
src/core/
├── README.md
├── index.ts                       # public surface (types + hooks + commands)
├── types/
│   ├── ids.ts                     # branded IDs (IdentityId, ProductId, …)
│   ├── entities.ts                # all entity interfaces
│   ├── events.ts                  # discriminated union of DomainEvent
│   ├── commands.ts                # command payload types
│   └── provenance.ts              # Provenance, ReasonCode
├── events/
│   ├── log.ts                     # append-only in-memory EventLog
│   ├── emit.ts                    # emit(event) → log + reducers + subscribers
│   └── subscribe.ts               # motion-event contract subscription
├── reducers/
│   ├── identity.ts
│   ├── marketplace.ts
│   ├── aiGovernance.ts
│   ├── plugin.ts
│   ├── audit.ts
│   └── root.ts                    # combines into DomainState
├── selectors/
│   ├── identity.ts                # getIdentityDossier, getStyleGenome, getMutationPath
│   ├── marketplace.ts             # getRecommendedProducts, getAlignedDesigners, getCart
│   ├── admin.ts                   # getAdminOverview
│   ├── portal.ts                  # getDesignerPortalOverview
│   ├── ai.ts                      # getAiControlState
│   └── provenance.ts              # getProvenanceTrace(entityId)
├── commands/
│   ├── identity.ts                # recordProductView, saveProduct, followDesigner
│   ├── cart.ts                    # addToCart, removeFromCart, setQty
│   ├── mutation.ts                # proposeMutation, ratifyMutation, rejectMutation
│   ├── ai.ts                      # updateAgentPrompt, enablePlugin, disablePlugin
│   └── index.ts
├── policies/
│   ├── dnaEvolution.ts            # damping rules: propose only; ratify to write
│   ├── recommendation.ts          # ranking + provenance construction
│   ├── access.ts                  # role gates (mirrors future RLS)
│   └── memory.ts                  # what AI may recall
├── engines/
│   ├── identity.ts                # command handlers → events
│   ├── marketplace.ts
│   ├── ai.ts
│   ├── governance.ts
│   ├── plugin.ts
│   ├── evolution.ts               # analyses signals → proposes mutations
│   └── analytics.ts               # derived read models over event log
├── adapters/
│   ├── memory.ts                  # in-memory persistence (default)
│   ├── localStorage.ts            # optional: hydrate/persist event log
│   └── PersistenceAdapter.ts      # interface both above implement
├── seed/
│   ├── index.ts                   # buildSeedEvents() → replay to genesis state
│   ├── designers.ts
│   ├── products.ts
│   ├── orders.ts
│   └── dna.ts
└── react/
    ├── CoreProvider.tsx           # wraps app, owns store + subscribers
    ├── useStore.ts                # subscribe to selector
    ├── useCommand.ts              # dispatch a command
    └── useDomainEvents.ts         # motion-event subscription

src/docs/
├── ARCHITECTURE.md                # NEW — layered model, engines, event flow
└── BACKEND.md                     # REWRITTEN — event store + projections
```

---

## 2. Entities (`types/entities.ts`)

Branded IDs from `types/ids.ts` (`IdentityId`, `ProductId`, `DesignerId`, `OrderId`, `AgentId`, …) — prevent cross-entity ID confusion at compile time.

```ts
interface Identity { id: IdentityId; profile: Profile; dna: DNA; wardrobe: Wardrobe; relationships: Relationships; memory: MemoryScope; createdAt: string }
interface Profile  { displayName: string; locale: string; consent: ConsentFlags }
interface DNA      { genome: StyleGenome; signals: DNASignal[]; mutations: Mutation[]; version: number; updatedAt: string }
interface StyleGenome { structure: number; edge: number; elegance: number; darkness: number; sensuality: number; utility: number }
interface Mutation { id: MutationId; from: Partial<StyleGenome>; to: Partial<StyleGenome>; rationale: string; status: "proposed"|"ratified"|"rejected"; proposedAt: string; sourceEventIds: EventId[] }
interface Wardrobe { saved: ProductId[]; owned: ProductId[]; considered: ProductId[] }
interface Relationships { follows: DesignerId[]; muted: DesignerId[] }
interface MemoryScope { allow: MemoryKey[]; deny: MemoryKey[] }

interface Designer { id; slug; name; location; slogan; bio; brandIds; memberSince; …stats }
interface Brand    { id; designerId; name }
interface Product  { id; slug; name; designerId; brandId?; price; category; gender; colors; sizes; status; description; genomeAffinity: Partial<StyleGenome> }
interface Collection { id; designerId; title; productIds }

interface Order { id; identityId; items: OrderItem[]; total; status; placedAt }
interface OrderItem { productId; size; qty; unitPrice }

interface Recommendation { id; identityId; productId; score; provenance: Provenance }

interface Agent { id: AgentId; audience: "customer"|"designer"|"admin"|"internal"; activePromptId: PromptVersionId; toolIds: ToolId[]; memoryPolicyId: string }
interface PromptVersion { id; agentId; body; author; createdAt; note; isActive }
interface KnowledgeSource { id; kind: "url"|"doc"|"collection"; ref; enabled }
interface PluginConnection { id; slug; status: "available"|"connected"|"disabled"; configSummary?: string }
interface Policy { id; scope: "content"|"safety"|"memory"|"response"; body: Record<string, unknown>; version: number }
interface AuditEvent { id; actor: IdentityId|"system"; action: string; entity: string; entityId: string; diff?: unknown; at: string }
```

`genomeAffinity` on Product is what lets recommendations be explained ("this coat scores high on Structure + Darkness — matches your rising Structure axis").

---

## 3. Domain events (`types/events.ts`)

Discriminated union `DomainEvent = { id: EventId; at: string; actor: IdentityId|"system"; cause?: EventId } & (…)`.

Variants (exhaustive, matches request):

```
identity.created            { identityId, profile }
profile.updated             { identityId, patch }
product.viewed              { identityId, productId, dwellMs? }
product.saved               { identityId, productId }
designer.followed           { identityId, designerId }
cart.item_added             { identityId, productId, size }
cart.item_removed           { identityId, productId, size }
cart.qty_set                { identityId, productId, size, qty }
order.placed                { identityId, orderId, items, total }
dna.signal_recorded         { identityId, signal }             # raw
dna.updated                 { identityId, genome, version }    # only via ratify
mutation.proposed           { identityId, mutation }
mutation.ratified           { identityId, mutationId }
mutation.rejected           { identityId, mutationId }
recommendation.reranked     { identityId, recommendationIds }
ai.prompt_updated           { agentId, promptVersionId }
ai.agent_configured         { agentId, patch }
ai.tool_enabled             { agentId, toolId }
ai.tool_disabled            { agentId, toolId }
policy.updated              { policyId, version }
audit.written               { auditId }
```

`cause` (parent event id) is what powers provenance traversal.

---

## 4. Reducers (`reducers/*`)

Each pure `(slice, event) => slice`. `root.ts` composes into:

```ts
interface DomainState {
  identities: Record<IdentityId, Identity>
  marketplace: { designers, brands, products, collections, orders, cartsByIdentity, recommendationsByIdentity }
  ai:          { agents, prompts, knowledgeSources, policies }
  plugins:     Record<PluginId, PluginConnection>
  audit:       AuditEvent[]
  // derived indices (rebuilt on demand, not stored)
}
```

Reducers ignore events they don't own — no defaults, no side effects.

---

## 5. Selectors (`selectors/*`)

Pure `(DomainState, args?) => view-model`. Memoized via a tiny `weakMemo` helper (WeakMap on state), no external deps.

Named exports mirror the spec exactly:
`getIdentityDossier`, `getStyleGenome`, `getMutationPath`, `getRecommendedProducts`, `getAlignedDesigners`, `getCart`, `getAdminOverview`, `getDesignerPortalOverview`, `getAiControlState`, `getProvenanceTrace`.

Each returns a plain object shaped for the corresponding page — pages consume selectors, not raw state.

---

## 6. Commands (`commands/*`)

A command is `(state, payload) => DomainEvent[]`. Never mutates. The store's `dispatch(command, payload)` runs the command, appends events, folds them, notifies subscribers.

Named exports mirror the spec exactly:
`recordProductView`, `saveProduct`, `followDesigner`, `addToCart`, `proposeMutation`, `ratifyMutation`, `rejectMutation`, `updateAgentPrompt`, `enablePlugin`, `disablePlugin` (plus `removeFromCart`, `setCartQty` for parity with existing UI).

Governance-sensitive commands go through `policies/access.ts` first; violations emit no events and return a typed error.

---

## 7. Policies (`policies/*`)

- **`dnaEvolution`** — engines/analytics may only call `proposeMutation`. `dna.updated` is only emitted by `ratifyMutation`. Rate-limits: at most one open proposal per axis. This is the damping the review demanded.
- **`recommendation`** — ranking function + provenance builder. Reads: identity genome, saved/viewed history, follows, product `genomeAffinity`. Emits `Recommendation` with a fully-populated `Provenance` (see §9).
- **`access`** — role gates keyed by future `has_role` semantics (`customer|designer|admin`). Today: single seeded identity has all roles.
- **`memory`** — what the AI layer is allowed to recall per identity; enforced when `engines/ai` composes context.

---

## 8. Event log & store (`events/*`)

- `log.ts` — append-only array + monotonically increasing `EventId`. Exposes `append`, `all`, `since(cursor)`.
- `emit.ts` — takes an event, appends to log, folds through `rootReducer`, fires subscribers.
- `subscribe.ts` — typed subscription for the motion-event contract (§10) and for React re-render.

State is always `replay(events)`; the "current" state is a cached fold invalidated on append. This guarantees a future backend can rehydrate from the same log.

---

## 9. Provenance (`types/provenance.ts` + `selectors/provenance.ts`)

```ts
interface Provenance {
  reason: string                         // human-readable sentence
  reasonCodes: ReasonCode[]              // machine-readable tags
  sourceEventIds: EventId[]              // links back into the log
  affectedAxes: (keyof StyleGenome)[]
  confidence: number                     // 0..1
  at: string
}
type ReasonCode =
  | "genome_alignment" | "saved_similar" | "follows_designer"
  | "collection_context" | "editorial_pick" | "cold_start"
```

Every `Recommendation` MUST carry a fully-populated `Provenance` — enforced by the recommendation policy's return type. `getProvenanceTrace(entityId)` walks `cause` links backward through the event log to produce an audit-ready trace for any recommendation, mutation, or AI response.

---

## 10. Motion-event contract (`events/subscribe.ts`)

Exports a single `subscribeToMotionEvents(handler)` that emits only the whitelisted set:

```
dna.updated, recommendation.reranked, mutation.proposed,
ai.responding, chart.constructed, route.entered
```

(`ai.responding`, `chart.constructed`, `route.entered` are UI-originated signals published *through* the same bus so the motion layer has one source of truth.) UI motion may not subscribe to any other event. Documented in `README.md` and enforced by an ESLint boundary rule (added in step 12).

---

## 11. Adapters & seed (`adapters/*`, `seed/*`)

- `PersistenceAdapter` interface: `load(): Event[] | Promise<Event[]>`, `append(events): void | Promise<void>`.
- `memory.ts` — default, in-process.
- `localStorage.ts` — optional, opt-in; persists event log under a versioned key. **Cart persistence migrates to this** (replacing the current `pawn-cart-v1` string blob) so cart survives reload with zero component churn.
- `seed/index.ts` — `buildSeedEvents()` returns the events required to reach today's mock world: identities created, designers/brands/products/collections registered, sample orders placed, an initial `dna.updated` seeded from `dnaSegments`. Loaded on first boot when the log is empty.

Existing `src/data/mock.ts` is kept, but its exports become **re-exports from `core/seed`** so any component not yet migrated continues to compile. Deletion is a later pass.

---

## 12. React bridge (`react/*`) — the only React-facing surface

- `<CoreProvider>` — instantiates store, loads adapter, wraps `<App>`. Sits **inside** the existing providers, replaces nothing.
- `useStore(selector, args?)` — subscribes to a selector; re-renders only on shallow change.
- `useCommand()` — returns typed `dispatch`.
- `useDomainEvents(types, handler)` — motion-event subscription (whitelist-checked).
- **`useCart`** in `src/store/cart.tsx` is rewritten as a thin adapter over `useStore(getCart)` + `useCommand()`. Public API unchanged → zero page changes.

Optional ESLint rule (config only, no code churn) forbids importing from `src/data/mock` outside `src/core/seed` and `src/store/*`.

---

## 13. Documentation

- **`src/core/README.md`** — 1 page. Layered model diagram, "how to add an event/command/selector", motion contract, non-goals.
- **`src/docs/ARCHITECTURE.md`** (new) — the layered model from Review §4.1, engine table, event backbone diagram, ratified-mutation flow, provenance model.
- **`src/docs/BACKEND.md`** (rewritten) — event store + outbox + projections. Explicitly frame `products/orders/order_items` as **projections** of the event log, not source of truth. Sketch the Supabase adapter contract that satisfies `PersistenceAdapter`. Keep the old schema in a "Legacy sketch" appendix for reference.

---

## 14. Execution order (file-by-file)

Each step ends with `bun run build` + typecheck. No route or visual change until the final step's verification.

1. `types/ids.ts`, `types/entities.ts`, `types/events.ts`, `types/commands.ts`, `types/provenance.ts`
2. `events/log.ts`, `events/emit.ts`, `events/subscribe.ts`
3. `reducers/*` + `reducers/root.ts`
4. `seed/*` + `adapters/memory.ts` + `adapters/PersistenceAdapter.ts`
5. `policies/access.ts`, `policies/dnaEvolution.ts`, `policies/recommendation.ts`, `policies/memory.ts`
6. `engines/*` (thin — mostly compose policies + emit events)
7. `selectors/*`
8. `commands/*`
9. `react/CoreProvider.tsx`, `react/useStore.ts`, `react/useCommand.ts`, `react/useDomainEvents.ts`
10. `index.ts` public surface
11. `adapters/localStorage.ts`
12. **Migrate `src/store/cart.tsx`** to core (public hook API unchanged). Add `CoreProvider` to `src/App.tsx` outside `CartProvider`.
13. **Migrate `src/data/mock.ts`** exports to re-export from `core/seed` (compat shim). No page edits.
14. `src/core/README.md`, `src/docs/ARCHITECTURE.md`, rewrite `src/docs/BACKEND.md`.
15. ESLint boundary rule for `src/data/mock` imports.
16. Full route walk (Playwright, all 16 routes) — assert no visual diff vs. pre-change screenshots. Assert cart persists across reload via the new adapter.

---

## 15. Acceptance criteria mapping

| Criterion | Satisfied by |
|---|---|
| UI can later be connected to core selectors instead of mock arrays | Steps 7, 13; `useStore(selector)` bridge |
| Future backend can persist event log without rewriting UI | `PersistenceAdapter` (§11), event log is the source of truth |
| AI Control Panel maps to real future domain objects | `Agent`, `PromptVersion`, `KnowledgeSource`, `PluginConnection`, `Policy` + `getAiControlState` |
| DNA evolution is event-driven and user-ratified | `dnaEvolution` policy (§7), `proposeMutation`/`ratifyMutation`/`rejectMutation` |
| Recommendations become explainable through provenance | `Provenance` type + recommendation policy return type (§9) |
| No visual regressions | Steps 12–13 are compat shims; step 16 verifies |

---

## Out of scope (again, explicit)

- Supabase / Lovable Cloud enablement
- Any real AI Gateway call
- New pages, new routes, new visual components
- Changes to existing page layouts
- Replacing shadcn primitives

Approve to execute steps 1 → 16 in order.
