import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DomainEvent } from "../types/events";
import type { DomainState } from "../reducers/root";
import { rootReducer } from "../reducers/root";
import { createEventLog, type EventLog } from "../events/log";
import { emit, type RawEvent } from "../events/emit";
import { buildSeedState, buildSeedEvents } from "../seed";
import { createMemoryAdapter } from "../adapters/memory";
import { createLocalStorageAdapter } from "../adapters/localStorage";
import { createSupabaseAdapter } from "../adapters/supabase";
import type { PersistenceAdapter } from "../adapters/PersistenceAdapter";
import type { CommandResult } from "../commands";

/**
 * Durable-event whitelist. Only events representing user-owned state that must
 * survive a reload go here — cart lines, saves, follows. Session-grade signals
 * (views, dwell, ephemeral AI chatter) are deliberately excluded so localStorage
 * cannot grow unbounded and so a private session leaves no residue. Any addition
 * here must also be considered in the schema-versioning contract of
 * `adapters/localStorage.ts`.
 */
const isDurable = (e: DomainEvent) =>
  e.type === "cart.item_added" ||
  e.type === "cart.item_removed" ||
  e.type === "cart.qty_set" ||
  e.type === "cart.cleared" ||
  e.type === "product.saved" ||
  e.type === "designer.followed";

type CommandFn<P> = (state: DomainState, payload: P) => CommandResult;

interface StoreApi {
  getState: () => DomainState;
  subscribe: (listener: () => void) => () => void;
  dispatch: <P>(command: CommandFn<P>, payload: P) => CommandResult;
  log: EventLog;
}

const CoreCtx = createContext<StoreApi | null>(null);

interface CoreProviderProps {
  children: ReactNode;
  /** Optional adapter override for tests. Default: memory + localStorage overlay. */
  adapter?: PersistenceAdapter;
  /** When present, adds a Supabase-backed adapter scoped to this user's identity. */
  userId?: string | null;
}

export function CoreProvider({ children, adapter, userId }: CoreProviderProps) {
  const localAdapter = useMemo(() => adapter ?? createLocalStorageAdapter("primary", isDurable), [adapter]);
  const memAdapter = useMemo(() => createMemoryAdapter(), []);
  const remoteAdapter = useMemo<PersistenceAdapter | null>(
    () => (userId ? createSupabaseAdapter(userId, isDurable) : null),
    [userId],
  );

  const initial = useMemo(() => {
    const state = buildSeedState();
    const persisted = localAdapter.load();
    const persistedEvents = Array.isArray(persisted) ? persisted : [];
    return persistedEvents.reduce((s, e) => rootReducer(s, e), state);
  }, [localAdapter]);

  const [state, setState] = useState<DomainState>(initial);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const listenersRef = useRef(new Set<() => void>());

  // Prime the log with seed events + persisted events (so provenance traces can walk them).
  const log = useMemo(() => {
    const l = createEventLog(buildSeedEvents());
    const persisted = localAdapter.load();
    (Array.isArray(persisted) ? persisted : []).forEach((e) => l.append(e));
    return l;
  }, [localAdapter]);

  // Hydrate from Supabase once a user is available. Any remote-only events are
  // replayed on top of local state; the local log is enriched so provenance
  // traces still resolve.
  useEffect(() => {
    if (!remoteAdapter) return;
    let cancelled = false;
    void Promise.resolve(remoteAdapter.load()).then((events) => {
      if (cancelled || events.length === 0) return;
      const knownIds = new Set<string>();
      log.all().forEach((e) => knownIds.add(e.id as unknown as string));
      const fresh = events.filter((e) => !knownIds.has(e.id as unknown as string));
      if (fresh.length === 0) return;
      fresh.forEach((e) => log.append(e));
      let next = stateRef.current;
      for (const e of fresh) next = rootReducer(next, e);
      stateRef.current = next;
      setState(next);
      listenersRef.current.forEach((l) => l());
    });
    return () => { cancelled = true; };
  }, [remoteAdapter, log]);

  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => { listenersRef.current.delete(listener); };
  }, []);

  const dispatch = useCallback(<P,>(command: CommandFn<P>, payload: P): CommandResult => {
    const result = command(stateRef.current, payload);
    if (!result.ok) return result;
    const emitted: DomainEvent[] = [];
    let next = stateRef.current;
    result.events.forEach((raw: RawEvent) => {
      const event = emit(log, raw);
      next = rootReducer(next, event);
      emitted.push(event);
    });
    stateRef.current = next;
    setState(next);
    void memAdapter.append(emitted);
    void localAdapter.append(emitted);
    if (remoteAdapter) void remoteAdapter.append(emitted);
    listenersRef.current.forEach((l) => l());
    return result;
  }, [log, localAdapter, memAdapter, remoteAdapter]);

  const api = useMemo<StoreApi>(() => ({
    getState: () => stateRef.current,
    subscribe,
    dispatch,
    log,
  }), [subscribe, dispatch, log]);

  return <CoreCtx.Provider value={api}>{children}</CoreCtx.Provider>;
}

export function useStoreApi(): StoreApi {
  const ctx = useContext(CoreCtx);
  if (!ctx) throw new Error("useStoreApi must be used inside CoreProvider");
  return ctx;
}
