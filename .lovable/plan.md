## PAWN — Item 1 Implementation Plan (Domain Core + Event Log, no visual change)

Item 1 from the review is largely in place already (`src/core/` exists, `mock.ts` is deleted, all 16 routes read via selectors, cart dispatches commands, 24 vitest specs pass). This plan formalizes the **closeout work** required to declare item 1 done and hand off cleanly to item 2 (provenance on every state change).

Scope is strictly non-visual and non-functional. No route changes, no new features, no styling.

---

### Goal

Leave the codebase in a state where:

- `src/core/` is the single source of domain truth.
- No page, component, or store bypasses selectors/commands.
- The event log is authoritative, replayable, and covered by tests.
- Item 2 (provenance traces on every mutation) can be started without refactors.

---

### Work items

**1. Boundary audit** — enforce the layering rule.
- Add an ESLint rule (or a simple `rg`-based CI check) forbidding imports of `@/core/reducers/*`, `@/core/events/*`, `@/core/adapters/*` from anywhere under `src/pages` or `src/components`. Pages may import only from `@/core` (public barrel), `@/core/selectors`, `@/core/commands`, `@/core/views`, `@/core/react`.
- Fix any violations surfaced.

**2. Public barrel hardening** — `src/core/index.ts`.
- Re-export exactly: `CoreProvider`, `useStore`, `useCommand`, `useDomainEvents`, all selectors namespaces, all commands, view types, entity types, branded IDs. Nothing else.
- Mark internal modules with a short header comment: "internal — do not import from surfaces."

**3. Cart adapter cleanup** — `src/store/cart.tsx`.
- Confirm it is a thin pass-through over `useStore` + `useCommand`. Remove any residual local state.
- Add a JSDoc note that this file exists only as a legacy shape adapter and should eventually be deleted in favor of direct core usage.

**4. Event log durability contract** — `src/core/react/CoreProvider.tsx`.
- Document the `isDurable` whitelist inline (which events persist, which are session-only).
- Add a schema-version constant (`CORE_EVENT_SCHEMA = 1`) written into the localStorage payload; on load, mismatched versions are discarded (fresh seed) rather than crashing.

**5. Compaction flag wiring** — `src/core/adapters/compaction.ts`.
- Keep the flag off by default. Add a one-paragraph README section explaining when to flip it and what `SnapshotRestored` implies for provenance walks (snapshots break `cause` chains — provenance must be captured *before* compaction).

**6. Selector stability guarantees** — `src/core/selectors/*`.
- Confirm every list-returning selector routes through `memoByState` or `memoByStateAndKey`. Add a test that iterates all exported selectors and asserts referential stability across an unrelated state change.

**7. Test coverage top-up**.
- Add specs for: seed determinism (same genesis → same state), replay equivalence (`replay(log.all()) === current state`), and the durable-event round-trip (persist → reload → equivalent state).
- Target: keep the suite green and above ~80% on `src/core/`.

**8. Docs pass** — `src/core/README.md` + `src/docs/ARCHITECTURE.md`.
- Add a "Rules for surfaces" section: read via selectors, write via commands, never import reducers/events/adapters.
- Add a short "What item 2 will add" paragraph so the provenance work has a documented landing spot.

**9. Closeout verification**.
- Run `tsgo`, `vitest run`, and a manual smoke of all 16 routes via Playwright screenshots to confirm zero visual/behavior regression.
- Produce a one-page changelog entry in `.lovable/plan.md` marking item 1 complete and item 2 unblocked.

---

### Explicitly out of scope

- Provenance traces on non-recommendation events (item 2).
- Ratified-mutation UX (item 3).
- AI Control Panel spine/extension split (item 4).
- Motion grammar enforcement (item 5).
- Supabase adapters (item 6).

---

### Risks

- **Boundary rule may surface hidden violations.** Mitigation: fix in the same PR; they are almost certainly type-only imports.
- **Schema-version gate could wipe a tester's local cart on first deploy.** Acceptable — cart is session-grade state and this only happens once.
- **Selector stability test may reveal a missed memoization.** That is the point; fix in place.

---

### Definition of done

- `tsgo` clean, `vitest run` green, coverage ≥ 80% on `src/core/`.
- No file under `src/pages` or `src/components` imports from `@/core/reducers`, `@/core/events`, or `@/core/adapters`.
- `src/core/index.ts` is the only import path used by surfaces.
- `.lovable/plan.md` updated with item 1 closeout note and item 2 entry point.
