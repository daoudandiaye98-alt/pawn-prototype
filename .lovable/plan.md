
# PAWN — Architectural Review v1

Not an implementation plan. A written architectural critique of where PAWN stands, where the stated vision is strong, where it is weak, and what structure would actually get it to "operating system for fashion identity" without collapsing under its own weight.

I am not going to rubber-stamp the brief. Several parts of it are right. Several parts are romantic and would kill the product if built literally.

---

## 1. Honest assessment of the current codebase

What the code actually is today:

- A React/Vite SPA with 16 routes and shadcn/ui.
- One React Context (`CartProvider`) backed by `localStorage`.
- A single static `src/data/mock.ts` shared by every page.
- No domain layer. Pages read mock arrays directly and render.
- No event model. No user model. No session. No identity.
- "DNA", "AI Control Panel", "Admin", "Portal" are visual surfaces over the same flat mock file.
- `src/docs/BACKEND.md` is the only place a system model exists, and it is still a conventional relational e-commerce schema (`products`, `orders`, `order_items`) with AI tables bolted on the side.

This matters because the brief says "the frontend is approaching maturity, the backend is in its infancy." That is not quite true. The **frontend is visually mature but architecturally is also infancy** — there is no data layer, no domain layer, no state machine, nothing that a real backend could slot behind. Redesigning the backend without introducing a domain layer on the client will just move the mock file to Postgres.

The real gap is the **missing middle**: a domain model that both the UI and the future backend agree on.

---

## 2. Where the vision is right

- **Identity as the center, not the catalog.** Correct and rare. Most fashion platforms are catalog-first with a user profile stapled on. Making Identity the primary aggregate is a genuine differentiator and it is architecturally cleaner (commerce becomes a projection of identity, not the other way around).
- **AI governance as product surface.** Correct. Prompt versioning, routing, evals, memory rules, per-audience agents (Customer/Designer/Admin/Internal) — this is where serious AI products are heading and most competitors have nothing here.
- **Interconnection between DNA, recommendations, discovery, designers.** Correct in principle. This is a graph, not a set of pages.
- **Motion as signal of computation.** Correct as a design principle. Motion-as-state is more defensible than motion-as-decoration.

## 3. Where the vision is wrong or dangerous

I have to push back on several points, because building them literally would produce an unshippable product.

### 3.1 "PAWN should feel alive, not animated"

The described loop — user interacts → PAWN learns → DNA evolves → marketplace evolves → AI evolves — is a **closed feedback loop with no damping**. In practice this produces:

- Recommendation collapse (the system narrows onto whatever the user clicked twice).
- Identity drift (DNA changes faster than the user's actual taste).
- Loss of trust ("why did my DNA change, I did nothing").

Fix: separate **fast state** (session, cart, current view) from **slow state** (DNA, taste vector, preferences). DNA should evolve on the order of weeks and only with **explicit user confirmation of mutations**. The system observes continuously, but only *proposes* evolution. The user ratifies. This is also better editorially — mutations become **events**, not background noise.

### 3.2 "Everything influences everything else"

Full interconnection is a graph with O(n²) coupling. It is also unauditable — you cannot explain a recommendation if six subsystems all touched it. For a brand that trades on **editorial clarity and intelligence you can trust**, unexplainable AI is a brand risk, not a feature.

Fix: define a **directed** influence graph, not a bidirectional web. Each edge is explicit, logged, and reversible. Every recommendation must carry a **provenance trace** ("This piece surfaced because your Structure axis rose 4 points after you saved three Lemaire coats"). Provenance is the actual PAWN differentiator. Nobody in luxury e-commerce does this.

### 3.3 "The backend should become the true product"

Half right. The **domain model** should be the true product. The backend is one deployment target of that domain model; the client is another. If the backend is treated as the product, the frontend team ends up building a thin skin and the domain leaks into SQL. Fashion identity is not a SQL problem.

Fix: extract a **`@pawn/core`** package (even inside this repo, `src/core/`) that owns entities, events, and reducers. Backend and UI both consume it. The UI can run the whole system in memory today; the backend can persist it tomorrow without changing a single component.

### 3.4 "AI Control Panel with 20+ surfaces"

Listed as one bullet list, it looks reasonable. As a build it is a small enterprise product on its own. Prompt A/B testing, eval harnesses, replay, cost analytics, multi-agent orchestration — each of these is a real team's roadmap.

Fix: cut the governance surface to a **spine plus extensions**. Spine = Agents, Prompts (versioned), Knowledge, Tools, Policies, Logs. Everything else (A/B, replay, evals, cost, KG, memory rules UI) is a **plugin panel** that lights up only when the corresponding backend capability exists. Ship the spine, register empty extension slots.

### 3.5 "Proprietary everything"

"Proprietary visual language, interaction language, diagrams, AI interfaces" is the kind of ambition that produces a product only the founder can use. Users need **familiar affordances** for commerce (cart, checkout, filters, sizing) and **novel affordances** only where PAWN's insight is genuinely new (Identity, Mutation, Provenance, Governance).

Fix: draw an explicit line. **Commerce surfaces = conventional and fast.** **Intelligence surfaces = proprietary and slow-reading.** Do not proprietary-ize the checkout. Do proprietary-ize the DNA dossier, the mutation path, and the AI control room.

### 3.6 "Motion should feel like PAWN is thinking"

Good principle, dangerous in practice on mobile and on accessibility. Constant subtle motion is a WCAG issue (`prefers-reduced-motion`) and a battery issue. And "thinking" motion where nothing is actually being computed is dishonest — it is decorative motion cosplaying as intelligence, which is worse than decorative motion.

Fix: motion is only allowed when it maps to a real event in the domain (`dna.recomputed`, `recommendation.reranked`, `mutation.proposed`, `agent.responding`). No idle "breathing." Full `prefers-reduced-motion` respect. Motion becomes a **language with a grammar**, not an ambient effect.

---

## 4. Proposed architecture

### 4.1 Layered model

```text
┌────────────────────────────────────────────────────────┐
│  Surfaces                                              │
│  Public · Boutique · Dossier · Portal · Admin          │
├────────────────────────────────────────────────────────┤
│  Experience layer (React)                              │
│  Route shells · view-models · motion grammar           │
├────────────────────────────────────────────────────────┤
│  Domain core  (src/core, framework-free TS)            │
│  Entities · Events · Reducers · Selectors · Policies   │
├────────────────────────────────────────────────────────┤
│  Engines (pure functions over the domain)              │
│  Identity · Marketplace · Knowledge · AI · Governance  │
│  Plugin · Analytics · Evolution                        │
├────────────────────────────────────────────────────────┤
│  Adapters                                              │
│  In-memory (today) · Supabase (later) · AI Gateway     │
└────────────────────────────────────────────────────────┘
```

Rules:
- Engines never import React.
- Surfaces never import adapters directly — only via engines.
- Every state change is an **event** with a type, actor, payload, and cause. The store is a reducer over events. This is the substrate for provenance, replay, and future backend sync.

### 4.2 The eight engines, properly bounded

Not eight departments. Eight **capabilities**, each with a defined input, output, and side-effect surface.

| Engine | Owns | Reads | Emits |
|---|---|---|---|
| Identity | `Identity`, `DNA`, `StyleGenome`, `Mutation` | interactions, ratifications | `dna.updated`, `mutation.proposed` |
| Marketplace | `Product`, `Collection`, `Designer`, `Order` | identity (for ranking only) | `order.placed`, `product.viewed` |
| Knowledge | designer bios, editorial, taxonomies, KG | curated + AI-extracted | `knowledge.linked` |
| AI | agents, prompts, tools, routing | knowledge, identity, policies | `ai.responded`, `ai.tool_called` |
| Governance | policies, roles, audit | all engines | `policy.violated`, `audit.written` |
| Plugin | connectors, capability registry | governance | `plugin.enabled` |
| Analytics | metrics, cohorts, cost/latency | all events | derived read models |
| Evolution | proposes DNA/marketplace changes | analytics, identity | `evolution.proposal` |

Identity is the only engine that can mutate a user's DNA. Evolution can **propose**, never write. This is the damping the vision is missing.

### 4.3 Event backbone

One append-only event log, in memory today, Postgres + outbox tomorrow. Every surface in the app is a **projection** over that log. This gives you, for free:

- Provenance ("why did I see this?").
- Replay (Admin AI → Conversation Replay is just re-running events).
- A/B (fork the log for a cohort).
- Audit (governance is a filtered projection).
- Time-travel dossiers ("your DNA six weeks ago").

Without this, none of the vision's items 1, 2, 6, 7 are actually achievable.

### 4.4 Identity as aggregate root

```text
Identity
├── Profile          (name, locale, consent)
├── DNA
│   ├── StyleGenome  (6 axes, versioned)
│   ├── Signals      (interactions, ratings, saves)
│   └── Mutations    (proposed, ratified, rejected)
├── Wardrobe         (owned, saved, considered)
├── Relationships    (followed designers, muted, blocked)
└── Memory           (what AI may recall, per policy)
```

Orders, recommendations, AI conversations, agent memory — all reference Identity, never duplicate its data. This is the single change that turns PAWN from an e-commerce app into an identity platform.

### 4.5 AI architecture, the honest version

Three real things, not twenty:

1. **Agent registry** — `customer`, `designer`, `admin`, `internal`. Each is a config: base prompt, tools, memory policy, routing rule.
2. **Prompt & policy store** — versioned, diffable, one active per agent per environment.
3. **Gateway adapter** — Lovable AI Gateway today, provider-swappable. Every call logged as an event with tokens/latency/cost.

Everything else the brief lists (KG, replay, A/B, evals, multi-agent) is a **capability slot** rendered as "Available — connect backend" until the corresponding adapter exists. Ship the spine, do not fake the extensions.

### 4.6 Motion grammar

Six motions, each bound to a domain event. Anything not in this list is not allowed.

| Motion | Fires on | Semantics |
|---|---|---|
| Hairline draw | route enter | structure appearing |
| Helix construct | `dna.updated` | identity recomputed |
| Rerank shift | `recommendation.reranked` | system re-thought |
| Mutation extend | `mutation.proposed` | future being drawn |
| Agent pulse | `ai.responding` | model is actually working |
| Chart construct | data-view mount | information being built |

All respect `prefers-reduced-motion` (collapse to instant state change, not a shorter animation).

### 4.7 Backend, when it arrives

Not the schema in `BACKEND.md`. That is an e-commerce schema.

The right backend is:

- **Event store** (append-only, partitioned by identity_id).
- **Projections** (materialized views for products, orders, dossiers, admin lists).
- **Command handlers** as edge functions, one per engine.
- **AI Gateway** on the edge, never client-side.
- **RLS** per identity + `has_role` for governance.
- **Outbox → plugins** for Stripe/email/analytics.

The current `products/orders/order_items` tables become **projections**, not sources of truth.

---

## 5. Risks the brief does not name

1. **Cold-start.** Identity-first platforms are empty for new users. Need a "Style Intake" ritual that produces a credible DNA in under 3 minutes. Without it, the whole system has nothing to reason about on day one.
2. **Explainability debt.** The moment AI influences recommendations, EU AI Act and consumer trust both require explanation. Provenance must be built in from event one, not retrofitted.
3. **Designer sovereignty.** If PAWN's AI ranks designers, designers will (rightly) demand to see the criteria. Governance must expose a "how am I ranked" surface to designers, or the marketplace side dies.
4. **Privacy of DNA.** A style-psychology dossier is personal data under GDPR. Export, delete, and "freeze evolution" must be first-class user actions, not settings-page afterthoughts.
5. **Content supply.** An intelligence engine with three mock designers is theatre. Editorial/knowledge ingestion is a real workstream and needs an owner before the AI surfaces have anything to say.
6. **Two-audience trap.** Customers want speed and clarity in commerce. The vision optimizes for slow editorial reading. These can coexist only if the split in §3.5 is enforced.
7. **Motion accessibility.** Already covered but worth listing as a first-class risk.
8. **Scope of AI Control Panel.** Left unbounded, it eats the roadmap. §3.4 spine/extension split is the mitigation.

---

## 6. What I recommend as the actual next pass (not this pass)

Order of work, once this review is accepted. Not to be executed now.

1. Introduce `src/core/` — entities, events, reducers, selectors. Migrate `mock.ts` behind it. No visual change.
2. Introduce the event log + provenance on every state change. Still in-memory.
3. Refactor DNA into Identity aggregate; add ratified-mutation flow.
4. Cut AI Control Panel to spine + extension slots.
5. Define the six-motion grammar; remove any motion not bound to a domain event.
6. Only then: enable Lovable Cloud, and port projections to Supabase behind the same engine interfaces.

Rebuilding the visuals again before step 1 would be the wrong move.

---

## 7. Bottom line

The brief's instinct is right: PAWN should not be another store.
The brief's mechanism is wrong: "everything influences everything, alive, always moving" produces an unexplainable, unshippable product.

The version that actually gets to "operating system for fashion identity":

- Identity is the aggregate root.
- Events are the substrate.
- Evolution proposes; the user ratifies.
- Provenance is the differentiator, not motion.
- AI governance ships as a spine, extends as capabilities come online.
- Commerce stays conventional; intelligence surfaces stay proprietary.
- The backend is a deployment target of a domain core that already runs in the browser.

Approve this review and I will turn item 1 (`src/core/` + event log, no visible change) into a concrete implementation plan.
