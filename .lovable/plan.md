# PAWN — Item 1 Closeout Changelog

**Status:** Complete. Item 2 (provenance on every state change) is unblocked.

## What shipped

- Public barrel (`src/core/index.ts`) is the only import surface for pages and components.
- Boundary rule enforced by `src/core/__tests__/boundaries.spec.ts` — no page/component imports from `@/core/reducers`, `@/core/events`, or `@/core/adapters`.
- Legacy `useCart` / `CartProvider` reduced to a documented shape adapter over the core store.
- Durable-event whitelist inlined and documented in `CoreProvider.tsx`.
- Schema-versioned localStorage envelope (`CORE_EVENT_SCHEMA = 1`) — mismatched or legacy payloads are discarded rather than replayed.
- Compaction adapter documented, flag-off, with note on provenance interaction.
- Test suite: 30 passing across 9 files. New coverage: boundaries, persistence round-trip + schema drift, seed determinism + replay equivalence.
- `src/core/README.md` gained a "Rules for surfaces" section and an item 2 handoff paragraph.

## What did not change

- No route changes, no visual changes, no new features.
- No new user-facing behavior.
- No backend work.

## Handoff to item 2 — Provenance on every state change

Landing spots that are ready today:

- `types/provenance.ts` already defines the `Provenance` shape.
- `selectors/provenance.ts` already walks `cause` chains.
- Command results (`types/commands.ts`) can carry `Provenance` alongside `events` — extend the type, thread it through `emit`, store it in the relevant reducer slice.
- Reducers to touch first: identity (mutations), marketplace (recommendations, saves), ai (prompt updates).

Do not enable compaction until item 2 is done and any surface that reads provenance has captured what it needs.
