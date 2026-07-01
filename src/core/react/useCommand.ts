import { useStoreApi } from "./CoreProvider";

export function useCommand() {
  return useStoreApi().dispatch;
}
