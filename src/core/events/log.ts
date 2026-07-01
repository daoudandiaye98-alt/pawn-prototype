import type { DomainEvent } from "../types/events";
import type { EventId } from "../types/ids";
import { asEventId } from "../types/ids";

let seq = 0;
export function nextEventId(): EventId {
  seq += 1;
  return asEventId(`evt_${Date.now().toString(36)}_${seq.toString(36)}`);
}

export interface EventLog {
  append(event: DomainEvent): void;
  all(): readonly DomainEvent[];
  since(cursor: number): readonly DomainEvent[];
  cursor(): number;
  clear(): void;
}

export function createEventLog(initial: DomainEvent[] = []): EventLog {
  const events: DomainEvent[] = [...initial];
  return {
    append(event) { events.push(event); },
    all() { return events; },
    since(cursor) { return events.slice(cursor); },
    cursor() { return events.length; },
    clear() { events.length = 0; },
  };
}
