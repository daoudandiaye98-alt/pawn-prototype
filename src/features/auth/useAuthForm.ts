import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

/**
 * Die eine Auth-Implementierung hinter /auth (Login-Vollseite) und dem Zugang-Schritt in
 * /start (First Move). Beide Hüllen rufen exakt dieselben Funktionen auf (signInWithPassword/
 * signUp/signInWithGoogle aus useAuth) — keine eigene Passwort-Validierung, keine eigene
 * Fehlerlogik pro Seite. "Reset" hier: das Passwort-Feld wird nach jedem Absenden und bei
 * jedem Moduswechsel geleert, egal welche Hülle den Hook nutzt.
 */
export type AuthMode = "in" | "up";

export function useAuthForm(opts: { initialMode?: AuthMode; onSuccess?: (mode: AuthMode) => void; checkEmailMessage?: string } = {}) {
  const { signInWithPassword, signUp, signInWithGoogle } = useAuth();
  const [mode, setModeState] = useState<AuthMode>(opts.initialMode ?? "in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  const setMode = (m: AuthMode) => {
    setModeState(m);
    setPassword("");
  };

  async function submit(e?: { preventDefault?: () => void }) {
    e?.preventDefault?.();
    setBusy(true);
    const { error } =
      mode === "in"
        ? await signInWithPassword(email.trim(), password)
        : await signUp(email.trim(), password, displayName.trim() || email.split("@")[0]);
    setBusy(false);
    setPassword("");
    if (error) { toast.error(error); return; }
    if (mode === "up") toast.success(opts.checkEmailMessage ?? "Prüfe deine E-Mail zur Bestätigung.");
    opts.onSuccess?.(mode);
  }

  async function submitGoogle() {
    setBusy(true);
    const { error } = await signInWithGoogle();
    setBusy(false);
    if (error) toast.error(error);
  }

  return { mode, setMode, email, setEmail, password, setPassword, displayName, setDisplayName, busy, submit, submitGoogle };
}
