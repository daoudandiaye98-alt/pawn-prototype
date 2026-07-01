# PAWN — Architecture

PAWN is structured as an **event-sourced domain core** with pluggable adapters.
The frontend renders projections; it does not own truth.

## Layers

| Layer | Location | Responsibility |
|---|---|---|
| UI | `src/pages`, `src/components` | Render selectors, dispatch commands, publish motion signals |
| React bridge | `src/core/react` | `CoreProvider`, `useStore`, `useCommand`, `useDomainEvents` |
| Selectors | `src/core/selectors` | Pure view-model builders |
| Commands | `src/core/commands` | Intent → events (validated) |
| Policies | `src/core/policies` | Business rules (DNA damping, recommendation ranking, memory scope) |
| Engines | `src/core/engines` | Compose policies + emit events (stateless helpers) |
| Reducers | `src/core/reducers` | `(slice, event) => slice`, framework-free |
| Event log | `src/core/events` | Append-only in-memory; motion-event bridge |
| Adapters | `src/core/adapters` | `memory`, `localStorage` today; `supabase` tomorrow |

## Identity is the aggregate root

An `Identity` owns `Profile`, `DNA`, `Wardrobe`, `Relationships`, `MemoryScope`.
All personalization derives from an identity's genome and history.

## Event backbone

```
Command ──► CommandResult{ ok, events } ──► emit ──► log.append
                                              ├──► rootReducer(state, event)
                                              ├──► bridgeDomainToMotion
                                              └──► notifyEventSubs
```

`replay(events)` reconstructs any state from the log. That is what makes a
future backend swap safe: persist the log, replay on boot.

## DNA evolution (proposal → ratification)

```
signals ──► engines/evolution ──► proposeMutation ──► mutation.proposed
                                                          │
                                                    user reviews
                                                    │           │
                                              ratifyMutation   rejectMutation
                                                    │
                                              dna.updated (with damping)
```

The user is the only actor allowed to write DNA. Damping (60% toward target)
prevents runaway drift.

## Provenance

Every `Recommendation` carries a `Provenance`:
`{ reason, reasonCodes[], sourceEventIds[], affectedAxes[], confidence, at }`.
`getProvenanceTrace(log, eventId)` walks `cause` links to build an audit-ready
chain. Recommendations are explainable by construction.

## Motion contract

The UI motion layer subscribes only to a whitelist. Domain-triggered animations
never depend on internal state changes — only on named signals.

## Why commerce tables are projections

`products`, `orders`, `carts` are folded views of registration and lifecycle
events. This is why the future Supabase schema will treat commerce tables as
**materialized read models**, not the source of truth — the event log is.
