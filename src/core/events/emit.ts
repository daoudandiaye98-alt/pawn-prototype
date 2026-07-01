import type { DomainEvent } from "../types/events";
import type { EventLog } from "./log";
import { nextEventId } from "./log";
import { bridgeDomainToMotion, notifyEventSubs } from "./subscribe";

/** Stamp envelope fields onto a raw event body and append to the log. */
export type RawEvent = Omit<DomainEvent, "id" | "at"> & { at?: string; id?: DomainEvent["id"] };

export function emit(log: EventLog, raw: RawEvent): DomainEvent {
  const event = {
    ...raw,
    id: raw.id ?? nextEventId(),
    at: raw.at ?? new Date().toISOString(),
  } as DomainEvent;
  log.append(event);
  bridgeDomainToMotion(event);
  notifyEventSubs(event);
  return event;
}

export function emitMany(log: EventLog, raws: RawEvent[]): DomainEvent[] {
  return raws.map((r) => emit(log, r));
}
