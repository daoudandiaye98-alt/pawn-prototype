# PAWN — Backend Roadmap (Future Supabase)

Not implemented yet. This document defines the adapter contract the current
frontend already conforms to, so the transition is additive.

## Contract

The frontend depends on a single interface:

```ts
interface PersistenceAdapter {
  load(): DomainEvent[] | Promise<DomainEvent[]>;
  append(events: DomainEvent[]): void | Promise<void>;
  clear?(): void | Promise<void>;
}
```

Today: `createMemoryAdapter` + `createLocalStorageAdapter`.
Tomorrow: `createSupabaseAdapter`. No page changes.

## Event store (source of truth)

```sql
create table public.domain_events (
  id text primary key,           -- EventId from client (deterministic)
  at timestamptz not null,
  actor text not null,           -- identity id or 'system'
  type text not null,
  cause text references public.domain_events(id),
  payload jsonb not null,
  identity_scope uuid            -- indexed for per-identity replay
);
create index on public.domain_events (identity_scope, at);
create index on public.domain_events (type, at);

grant select, insert on public.domain_events to authenticated;
grant all on public.domain_events to service_role;
alter table public.domain_events enable row level security;

create policy "identity reads its own events"
  on public.domain_events for select to authenticated
  using (identity_scope = auth.uid());
create policy "identity appends its own events"
  on public.domain_events for insert to authenticated
  with check (identity_scope = auth.uid() and actor = auth.uid()::text);
```

System-produced events (registry, orders after payment webhook) are inserted
via `service_role` from edge functions.

## Projections (read models)

Commerce tables (`products`, `designers`, `orders`, `order_items`, `carts`) are
**materialized projections** rebuilt by database triggers or a background
worker that consumes `domain_events`. They are optimized for query, not for
truth. Rebuilding a projection from scratch is always safe.

## AI Gateway

The AI Control Panel today reads/writes to `Agent`, `PromptVersion`,
`KnowledgeSource`, `Policy`, `PluginConnection` in the domain core. When a real
AI Gateway is wired in:

- `engines/ai.ts` composes `context = { agent, activePrompt, knowledge, memory }`
  respecting the memory policy.
- The gateway call is a side-effect; its request/response are recorded as a
  `ai.responded` event with `cause = ai.requested.id`.
- Provenance for AI answers walks the same `cause` chain used for recommendations.

## Legacy sketch (kept for reference)

The earlier per-entity table sketch is superseded by the event-store approach
above. Projections replace what those tables used to hold. Keep RLS defaults
per the workspace `user-roles` and `public-schema-grants` conventions.
