import type { DomainEvent } from "../types/events";
import type { PersistenceAdapter } from "./PersistenceAdapter";

const KEY_PREFIX = "pawn-eventlog-v1:";

/**
 * localStorage-backed adapter. Only meant for durable UX state (cart, dismissed
 * prompts) that should survive a reload. Guards against SSR and quota errors.
 */
export function createLocalStorageAdapter(bucket: string, includes: (e: DomainEvent) => boolean): PersistenceAdapter {
  const key = KEY_PREFIX + bucket;
  const read = (): DomainEvent[] => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as DomainEvent[]) : [];
    } catch { return []; }
  };
  const write = (events: DomainEvent[]) => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(key, JSON.stringify(events)); } catch { /* ignore quota */ }
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
