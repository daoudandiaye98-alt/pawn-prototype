/**
 * EditModeProvider — website-builder toggle for admins.
 * When enabled, <Editable> wrappers become contentEditable and save to site_content.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";

interface EditModeCtx {
  enabled: boolean;
  isAdmin: boolean;
  toggle: () => void;
  disable: () => void;
}

const Ctx = createContext<EditModeCtx>({ enabled: false, isAdmin: false, toggle: () => {}, disable: () => {} });

const STORAGE_KEY = "pawn:edit-mode";

export function EditModeProvider({ children }: { children: ReactNode }) {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!isAdmin) { setEnabled(false); return; }
    try { setEnabled(sessionStorage.getItem(STORAGE_KEY) === "1"); } catch { /* noop */ }
  }, [isAdmin]);

  const toggle = useCallback(() => {
    setEnabled((v) => {
      const next = !v;
      try { sessionStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* noop */ }
      return next;
    });
  }, []);

  const disable = useCallback(() => {
    setEnabled(false);
    try { sessionStorage.setItem(STORAGE_KEY, "0"); } catch { /* noop */ }
  }, []);

  return <Ctx.Provider value={{ enabled: enabled && isAdmin, isAdmin, toggle, disable }}>{children}</Ctx.Provider>;
}

export function useEditMode() {
  return useContext(Ctx);
}
