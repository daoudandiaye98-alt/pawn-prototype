// Selector-identity stability helpers. See src/core/README.md.
//
// Rules:
//   1. Same state in → same reference out.
//   2. Use `memoByState` for whole-state derivations.
//   3. Use `memoByStateAndKey` for per-id derivations.

import type { DomainState } from "../reducers/root";

export function memoByState<T>(compute: (state: DomainState) => T): (state: DomainState) => T {
  const cache = new WeakMap<DomainState, T>();
  return (state) => {
    const hit = cache.get(state);
    if (hit !== undefined) return hit;
    const value = compute(state);
    cache.set(state, value);
    return value;
  };
}

export function memoByStateAndKey<K, T>(
  compute: (state: DomainState, key: K) => T,
): (state: DomainState, key: K) => T {
  const cache = new WeakMap<DomainState, Map<K, T>>();
  return (state, key) => {
    let inner = cache.get(state);
    if (!inner) {
      inner = new Map();
      cache.set(state, inner);
    }
    if (inner.has(key)) return inner.get(key) as T;
    const value = compute(state, key);
    inner.set(key, value);
    return value;
  };
}
