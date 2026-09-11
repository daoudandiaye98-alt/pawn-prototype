/**
 * Registrieren mit Passwort-Wiederholung — die EINE Stelle, an der verglichen wird.
 *
 * Teil L7. Es gibt zwei Hüllen, die jemanden anlegen können: die React-Masken
 * (/start) über `useAuthForm`, und die Zugang-Doppelseite im Heft, die aus
 * Vanilla-JS über einen Port hereinruft. Stünde der Vergleich in beiden, würde
 * einer davon irgendwann vergessen — und ein Vertipper im Passwort fällt erst
 * beim nächsten Anmelden auf, wenn das Konto längst angelegt ist.
 *
 * Deshalb: eine Funktion, beide rufen sie. Vergleich VOR `signUp`.
 */

export interface Registrierung {
  email: string;
  passwort: string;
  wiederholung: string;
  name?: string;
}

type SignUp = (email: string, passwort: string, name: string) => Promise<{ error?: string }>;

/**
 * @param signUp   die echte Anlage (aus `useAuth`)
 * @param daten    was der Mensch eingetippt hat
 * @param ungleich der übersetzte Satz für „die beiden Passwörter sind nicht gleich"
 * @returns `{}` bei Erfolg, sonst `{ fehler }` — nie eine Ausnahme.
 */
export async function registrieren(
  signUp: SignUp,
  daten: Registrierung,
  ungleich: string,
): Promise<{ fehler?: string }> {
  if (daten.passwort !== daten.wiederholung) return { fehler: ungleich };
  const email = daten.email.trim();
  const name = (daten.name ?? "").trim() || email.split("@")[0];
  const { error } = await signUp(email, daten.passwort, name);
  return error ? { fehler: error } : {};
}
