import type { DomainEvent } from "../types/events";
import type { AuditEvent } from "../types/entities";
import type { AuditId } from "../types/ids";
import { asAuditId } from "../types/ids";

export interface AuditSlice { entries: AuditEvent[] }
export const initialAuditSlice: AuditSlice = { entries: [] };

let seq = 0;
export function nextAuditId(): AuditId {
  seq += 1;
  return asAuditId(`aud_${Date.now().toString(36)}_${seq.toString(36)}`);
}

/** Audit slice mirrors every domain event as a passive trace. */
export function auditReducer(slice: AuditSlice, event: DomainEvent): AuditSlice {
  if (event.type === "audit.written") return slice; // avoid recursion
  const entry: AuditEvent = {
    id: nextAuditId(),
    actor: event.actor,
    action: event.type,
    entity: event.type.split(".")[0],
    entityId: event.id,
    at: event.at,
  };
  return { entries: [entry, ...slice.entries].slice(0, 1000) };
}
