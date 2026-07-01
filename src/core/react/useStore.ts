import { useRef } from "react";
import { useSyncExternalStoreWithSelector } from "use-sync-external-store/shim/with-selector";
import { useStoreApi } from "./CoreProvider";
import type { DomainState } from "../reducers/root";

/**
 * Subscribe to a selector; only re-renders when the selector output changes.
 *
 * Uses `useSyncExternalStoreWithSelector` so that (a) selector results are
 * memoised across calls within the same state and (b) equality is checked with
 * a shallow comparator. This is the last-line defence against selectors that
 * accidentally return a fresh reference for equivalent data — without it,
 * React's `checkIfSnapshotChanged` can loop indefinitely ("Maximum update depth
 * exceeded") whenever a page composes selectors inline.
 */
function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  }
  return true;
}

export function useStore<T>(selector: (state: DomainState) => T): T {
  const api = useStoreApi();
  // Keep a stable reference to the selector so identity churn from inline
  // arrow functions doesn't defeat the internal memoisation.
  const selRef = useRef(selector);
  selRef.current = selector;
  const stableSelector = useRef((s: DomainState) => selRef.current(s)).current;
  return useSyncExternalStoreWithSelector(
    api.subscribe,
    api.getState,
    api.getState,
    stableSelector,
    shallowEqual,
  );
}
