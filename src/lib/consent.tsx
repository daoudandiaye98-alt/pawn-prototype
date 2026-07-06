/**
 * PAWN Consent
 * ------------
 * Kurswechsel: wir NUTZEN persistente Speicherung, aber transparent.
 *
 * - "accepted"    → localStorage/cookies dürfen persistieren, Signale werden
 *                   dauerhaft aggregiert und beim Login mit dem Konto verknüpft.
 * - "essential"   → nur technisch notwendige Speicher, Signale bleiben in-memory.
 * - null          → noch nicht entschieden, Banner sichtbar.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ConsentValue = "accepted" | "essential" | null;

const COOKIE = "pawn_consent";
const STORAGE = "pawn.consent.v1";
const ONE_YEAR = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}
function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${ONE_YEAR}; Path=/; SameSite=Lax`;
}
function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function readInitial(): ConsentValue {
  if (typeof window === "undefined") return null;
  const c = readCookie(COOKIE);
  if (c === "accepted" || c === "essential") return c;
  try {
    const s = localStorage.getItem(STORAGE);
    if (s === "accepted" || s === "essential") return s;
  } catch { /* noop */ }
  return null;
}

interface Ctx {
  value: ConsentValue;
  decided: boolean;
  allowsPersistence: boolean;
  setConsent: (v: Exclude<ConsentValue, null>) => void;
  reopen: () => void;
  bannerOpen: boolean;
  openSettings: boolean;
  setOpenSettings: (v: boolean) => void;
}

const ConsentCtx = createContext<Ctx | null>(null);

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<ConsentValue>(() => readInitial());
  const [openSettings, setOpenSettings] = useState(false);

  const setConsent = useCallback((v: Exclude<ConsentValue, null>) => {
    setValue(v);
    writeCookie(COOKIE, v);
    try { localStorage.setItem(STORAGE, v); } catch { /* noop */ }
    // On decline: purge cached personalization/session data.
    if (v === "essential") {
      try {
        localStorage.removeItem("pawn.personalization.cache.v1");
        localStorage.removeItem("palace.chat.session_id");
        localStorage.removeItem("pawn.anon.signal.queue");
      } catch { /* noop */ }
      clearCookie("palace_session");
    }
    setOpenSettings(false);
  }, []);

  const reopen = useCallback(() => setOpenSettings(true), []);

  const val = useMemo<Ctx>(() => ({
    value,
    decided: value !== null,
    allowsPersistence: value === "accepted",
    setConsent,
    reopen,
    bannerOpen: value === null || openSettings,
    openSettings,
    setOpenSettings,
  }), [value, openSettings, setConsent, reopen]);

  useEffect(() => {
    // Listen for cross-tab consent changes.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE) setValue(readInitial());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return <ConsentCtx.Provider value={val}>{children}</ConsentCtx.Provider>;
}

export function useConsent(): Ctx {
  const ctx = useContext(ConsentCtx);
  if (!ctx) {
    // Safe fallback when Provider is missing (never persistent).
    return {
      value: null, decided: false, allowsPersistence: false,
      setConsent: () => {}, reopen: () => {},
      bannerOpen: false, openSettings: false, setOpenSettings: () => {},
    };
  }
  return ctx;
}
