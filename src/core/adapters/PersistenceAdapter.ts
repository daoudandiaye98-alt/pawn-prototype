import type { DomainEvent } from "../types/events";

export interface PersistenceAdapter {
  load(): DomainEvent[] | Promise<DomainEvent[]>;
  append(events: DomainEvent[]): void | Promise<void>;
  clear?(): void | Promise<void>;
}
