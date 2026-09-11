import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { registrieren } from "@/features/auth/registrieren";

/**
 * Die eine Auth-Implementierung hinter /auth (Login-Vollseite) und dem Zugang-Schritt in
 * /start (First Move). Beide Hüllen rufen exakt dieselben Funktionen auf (signInWithPassword/
 * signUp/signInWithGoogle aus useAuth) — keine eigene Passwort-Validierung, keine eigene
 * Fehlerlogik pro Seite. "Reset" hier: das Passwort-Feld wird nach jedem Absenden und bei
 * jedem Moduswechsel geleert, egal welche Hülle den Hook nutzt.
 *
 * Teil L7 — die Passwort-Wiederholung. Beim Registrieren wird das Passwort zweimal
 * verlangt und HIER verglichen, vor `signUp`. Einmal, an dieser Stelle, fuer jede
 * Huelle: wer eine neue Anmeldemaske baut, bekommt die Pruefung geschenkt und kann
 * sie nicht vergessen. Ein Vertipper im Passwort ist sonst erst beim naechsten
 * Anmelden zu merken — und dann ist das Konto schon angelegt.
 */
export type AuthMode = "in" | "up";

export function useAuthForm(opts: { initialMode?: AuthMode; onSuccess?: (mode: AuthMode) => void; checkEmailMessage?: string } = {}) {
  const { signInWithPassword, signUp, signInWithGoogle } = useAuth();
  const { t } = useI18n();
  const [mode, setModeState] = useState<AuthMode>(opts.initialMode ?? "in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  const setMode = (m: AuthMode) => {
    setModeState(m);
    setPassword("");
    setPasswordRepeat("");
  };

  async function submit(e?: { preventDefault?: () => void }) {
    e?.preventDefault?.();
    // Der Vergleich der beiden Passwoerter steht in features/auth/registrieren.ts —
    // dieselbe Funktion, die auch die Zugang-Doppelseite im Heft ruft. Er faellt VOR
    // signUp: ein angelegtes Konto mit vertipptem Passwort bekommt man nicht mehr los.
    setBusy(true);
    const { fehler } =
      mode === "in"
        ? await signInWithPassword(email.trim(), password).then((r) => ({ fehler: r.error }))
        : await registrieren(signUp, { email, passwort: password, wiederholung: passwordRepeat, name: displayName }, t("auth.passwordMismatch"));
    setBusy(false);
    // Nur die Wiederholung wird geleert, wenn sie nicht passte — das erste Feld
    // bleibt stehen, sonst tippt man beide Male neu.
    if (fehler === t("auth.passwordMismatch")) { setPasswordRepeat(""); toast.error(fehler); return; }
    setPassword("");
    setPasswordRepeat("");
    if (fehler) { toast.error(fehler); return; }
    if (mode === "up") toast.success(opts.checkEmailMessage ?? "Prüfe deine E-Mail zur Bestätigung.");
    opts.onSuccess?.(mode);
  }

  async function submitGoogle(ziel?: string) {
    setBusy(true);
    const { error } = await signInWithGoogle(ziel);
    setBusy(false);
    if (error) toast.error(error);
  }

  return { mode, setMode, email, setEmail, password, setPassword, passwordRepeat, setPasswordRepeat, displayName, setDisplayName, busy, submit, submitGoogle };
}
