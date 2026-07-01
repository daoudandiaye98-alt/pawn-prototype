import type { DomainEvent } from "../types/events";
import type { PersistenceAdapter } from "./PersistenceAdapter";

/**
 * Event schema version. Bump when the shape of any persisted `DomainEvent`
 * changes in a non-backward-compatible way. On load, mismatched payloads are
 * discarded (fresh seed) rather than fed to reducers that no longer understand
 * them. Cart is session-grade state — losing it once on a schema bump is
 * acceptable and preferable to a corrupt replay.
 */
export const CORE_EVENT_SCHEMA = 1;

const KEY_PREFIX = "pawn-eventlog-v1:";

interface Envelope {
  schema: number;
  events: DomainEvent[];
}

/**
 * localStorage-backed adapter. Only meant for durable UX state (cart, saves,
 * follows) that should survive a reload. Guards against SSR, quota errors, and
 * schema drift.
 */
export function createLocalStorageAdapter(
  bucket: string,
  includes: (e: DomainEvent) => boolean,
): PersistenceAdapter {
  const key = KEY_PREFIX + bucket;
  const read = (): DomainEvent[] => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Envelope | DomainEvent[];
      // Legacy (unversioned) payloads are discarded.
      if (Array.isArray(parsed)) return [];
      if (parsed.schema !== CORE_EVENT_SCHEMA) return [];
      return Array.isArray(parsed.events) ? parsed.events : [];
    } catch { return []; }
  };
  const write = (events: DomainEvent[]) => {
    if (typeof window === "undefined") return;
    try {
      const envelope: Envelope = { schema: CORE_EVENT_SCHEMA, events };
      window.localStorage.setItem(key, JSON.stringify(envelope));
    } catch { /* ignore quota */ }
  };
  let cache = read();
  return {
    load: () => cache,
    append: (batch) => {
      const persistable = batch.filter(includes);
      if (persistable.length === 0) return;
      cache = [...cache, ...persistable];
      write(cache);
    },
    clear: () => { cache = []; write(cache); },
  };
}
