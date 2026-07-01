import { useEffect } from "react";
import { subscribeToMotionEvents, type MotionEventType, type MotionSignal } from "../events/subscribe";

/** Subscribe to whitelisted motion events. Any other type is rejected upstream. */
export function useDomainEvents(types: MotionEventType[], handler: (signal: MotionSignal) => void) {
  useEffect(() => {
    const set = new Set<MotionEventType>(types);
    return subscribeToMotionEvents((signal) => {
      if (set.has(signal.type)) handler(signal);
    });
  }, [types, handler]);
}
