/**
 * Room shift — a hairline sentence that appears once and dismisses itself.
 * The house's way of acknowledging a change without turning it into UI chrome.
 * Not a toast. No icon, no close button. It fades. It goes.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

interface Shift {
  id: number;
  text: string;
}

interface Ctx {
  push: (text: string) => void;
  current: Shift | null;
}

const RoomShiftCtx = createContext<Ctx | null>(null);

export function RoomShiftProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Shift | null>(null);
  const seq = useRef(0);
  const timer = useRef<number | null>(null);

  const push = useCallback((text: string) => {
    seq.current += 1;
    setCurrent({ id: seq.current, text });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCurrent(null), 6000);
  }, []);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  return (
    <RoomShiftCtx.Provider value={{ push, current }}>
      {children}
      <RoomShiftLine shift={current} />
    </RoomShiftCtx.Provider>
  );
}

function RoomShiftLine({ shift }: { shift: Shift | null }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center px-6"
    >
      {shift && (
        <p
          key={shift.id}
          className="animate-fade-up border-b border-foreground/25 pb-1 font-cormorant text-[0.95rem] italic tracking-wide text-foreground/75"
        >
          {shift.text}
        </p>
      )}
    </div>
  );
}

export function useRoomShift() {
  const ctx = useContext(RoomShiftCtx);
  if (!ctx) return { push: (_: string) => {}, current: null };
  return ctx;
}
