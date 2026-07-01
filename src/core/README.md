# `src/core/` — PAWN Domain Core

The framework-free middle layer between UI and the future backend. Pages read
projections via selectors and emit intent via commands; the core owns meaning.

## Layered model

```
UI (React pages)                — reads selectors, dispatches commands
  │
CoreProvider (react/)           — the only React-facing surface
  │
Commands  ──►  Reducers  ──►  Selectors
  │              │
  └──────────►  Event Log  ◄──  Adapters (memory / localStorage / future Supabase)
                    │
                    └──►  Motion bus (whitelisted signals only)
```

## Rules for surfaces

Pages and components may import **only** from these paths:

- `@/core` (the public barrel)
- `@/core/selectors/*`
- `@/core/commands`
- `@/core/views`
- `@/core/react`

They must **never** import from `@/core/reducers/*`, `@/core/events/*`, or
`@/core/adapters/*`. This is enforced by `__tests__/boundaries.spec.ts`.

State is read via selectors and written via commands. Nothing else.

## Compaction (flag-gated)

`adapters/compaction.ts` can fold the durable event log into a snapshot event
(`SnapshotRestored`) to bound growth. It is **off by default** and should stay
off until item 2 (provenance) is complete: snapshots break the `cause` chains
that provenance traces walk, so any provenance a surface needs to display must
be captured before its source events are compacted away.

## What item 2 will add

Provenance is already stamped on `Recommendation` but not on other mutations.
Item 2 extends the pattern: every command result will carry a `Provenance`
alongside its events, reducers will store it against the affected entities, and
`getProvenanceTrace` will return a fully typed chain for any observable change.
No new surfaces required — the DNA dossier and admin AI logs simply gain a
"why" affordance.

## Rules


- **Framework-free.** No React/Vite/Tailwind imports inside `src/core/*` except `react/`.
- **Events are the only writer.** Commands return `RawEvent[]`; the store appends
  them to the log and folds them via the reducers. No component mutates state.
- **Selectors are pure** functions of `DomainState`. They never fetch.
- **Provenance is required** for every `Recommendation`.
- **DNA is proposal-then-ratification.** `dna.updated` only ever comes from
  `ratifyMutation`; engines may only propose.

## Adding an event

1. Add a variant to `types/events.ts`.
2. Handle it in the appropriate reducer.
3. If a UI intent produces it, add a command in `commands/index.ts`.
4. If it belongs on the motion bus, add it to the whitelist in `events/subscribe.ts`.

## Motion contract

Only these signals reach the UI motion layer:

```
dna.updated · recommendation.reranked · mutation.proposed
ai.responding · chart.constructed · route.entered
```

Publish UI-originated signals with `publishMotion(type, payload?)`.

## Non-goals

- No network calls.
- No Supabase, no AI Gateway, no analytics vendors.
- No UI primitives — those live under `src/components/`.
