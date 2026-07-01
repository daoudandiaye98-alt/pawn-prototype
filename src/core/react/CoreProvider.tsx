import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DomainEvent } from "../types/events";
import type { DomainState } from "../reducers/root";
import { rootReducer } from "../reducers/root";
import { createEventLog, type EventLog } from "../events/log";
import { emit, type RawEvent } from "../events/emit";
import { buildSeedState, buildSeedEvents } from "../seed";
import { createMemoryAdapter } from "../adapters/memory";
import { createLocalStorageAdapter } from "../adapters/localStorage";
import type { PersistenceAdapter } from "../adapters/PersistenceAdapter";
import type { CommandResult } from "../commands";

/** Events that we want to persist across reloads (durable UX state). */
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
}

export function CoreProvider({ children, adapter }: CoreProviderProps) {
  const localAdapter = useMemo(() => adapter ?? createLocalStorageAdapter("primary", isDurable), [adapter]);
  const memAdapter = useMemo(() => createMemoryAdapter(), []);

  const initial = useMemo(() => {
    const state = buildSeedState();
    // Replay any persisted events onto seed state.
    const persisted = localAdapter.load();
    const persistedEvents = Array.isArray(persisted) ? persisted : [];
    return persistedEvents.reduce((s, e) => rootReducer(s, e), state);
  }, [localAdapter]);

  const [state, setState] = useState<DomainState>(initial);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Prime the log with seed events + persisted events (so provenance traces can walk them).
  const log = useMemo(() => {
    const l = createEventLog(buildSeedEvents());
    const persisted = localAdapter.load();
    (Array.isArray(persisted) ? persisted : []).forEach((e) => l.append(e));
    return l;
  }, [localAdapter]);

  const listenersRef = useRef(new Set<() => void>());
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
    listenersRef.current.forEach((l) => l());
    return result;
  }, [log, localAdapter, memAdapter]);

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
