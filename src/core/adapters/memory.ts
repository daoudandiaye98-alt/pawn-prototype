import type { DomainEvent } from "../types/events";
import type { PersistenceAdapter } from "./PersistenceAdapter";

export function createMemoryAdapter(initial: DomainEvent[] = []): PersistenceAdapter {
  let events: DomainEvent[] = [...initial];
  return {
    load: () => events,
    append: (batch) => { events = [...events, ...batch]; },
    clear: () => { events = []; },
  };
}
