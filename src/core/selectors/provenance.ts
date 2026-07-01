import type { DomainEvent } from "../types/events";
import type { EventId } from "../types/ids";

export interface ProvenanceTrace {
  root: DomainEvent | null;
  chain: DomainEvent[];
}

/**
 * Walk `cause` links backward through the event log for an arbitrary entity id.
 * Used to explain any recommendation, mutation, or AI response.
 */
export function getProvenanceTrace(log: readonly DomainEvent[], eventId: EventId): ProvenanceTrace {
  const byId = new Map(log.map((e) => [e.id, e]));
  const chain: DomainEvent[] = [];
  let current: DomainEvent | undefined = byId.get(eventId);
  const seen = new Set<EventId>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.push(current);
    current = current.cause ? byId.get(current.cause) : undefined;
  }
  return { root: chain[chain.length - 1] ?? null, chain };
}
