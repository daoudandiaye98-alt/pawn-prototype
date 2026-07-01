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
