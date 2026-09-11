/**
 * Die drei Publikumstueren. Eine Stelle, an der steht, wohin jemand nach der
 * Anmeldung gehoert — damit /auth, das Heft und jede kuenftige Huelle dieselbe
 * Antwort geben.
 *
 * Teil L8. Vorher stand diese Entscheidung als `homeForRoles` in Auth.tsx und
 * nirgends sonst; das Heft schickte jeden auf /konto, egal ob Haus oder Cockpit.
 */

export const TUEREN = {
  admin: "/admin",
  designer: "/studio",
  kundschaft: "/konto",
} as const;

/** Wohin gehoert, wer diese Rollen hat? Admin schlaegt Designer schlaegt Kundschaft. */
export function tuerFuerRollen(rollen: readonly string[] | null | undefined): string {
  const r = rollen ?? [];
  if (r.includes("admin")) return TUEREN.admin;
  if (r.includes("designer")) return TUEREN.designer;
  return TUEREN.kundschaft;
}

/**
 * Ein Rueckkehrziel, dem man trauen kann.
 *
 * Nur eigene, relative Pfade. Kein `//host` (das waere ein fremder Server mit
 * geerbtem Schema), kein `/auth` (das leitet selbst weiter — eine Schleife),
 * nichts mit Steuerzeichen darin. Gibt `null` zurueck, wenn das Ziel nicht
 * taugt; dann entscheidet die Rolle.
 */
export function sichererPfad(wert: string | null | undefined): string | null {
  if (typeof wert !== "string") return null;
  const p = wert.trim();
  if (!p.startsWith("/")) return null;
  if (p.startsWith("//") || p.startsWith("/\\")) return null;
  if (/[\u0000-\u001F\u007F]/.test(p)) return null;
  const nurPfad = p.split("?")[0].split("#")[0].replace(/\/+$/, "");
  if (nurPfad === "/auth") return null;
  return p;
}
