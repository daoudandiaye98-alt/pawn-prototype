import { useSyncExternalStore } from "react";
import { useStoreApi } from "./CoreProvider";
import type { DomainState } from "../reducers/root";

/** Subscribe to a selector; only re-renders when the selector output changes by reference. */
export function useStore<T>(selector: (state: DomainState) => T): T {
  const api = useStoreApi();
  return useSyncExternalStore(api.subscribe, () => selector(api.getState()), () => selector(api.getState()));
}
