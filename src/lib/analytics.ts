/**
 * Teil L1 — Ereignis-Zählung über Plausible (cookielos, keine personenbezogenen Daten).
 * Das Skript wird in index.html geladen; hier nur ein dünner, fehlertoleranter Wrapper.
 * Läuft Plausible nicht (Adblocker, Konto noch nicht angelegt), passiert schlicht nichts.
 */

type PlausibleFn = (event: string, options?: { props?: Record<string, string | number> }) => void;

export type PawnEvent =
  | "start_begonnen"
  | "zug1_abgeschlossen"
  | "zug2_abgeschlossen"
  | "zug3_abgeschlossen"
  | "live_gegangen"
  | "anfrage_gesendet";

export function track(event: PawnEvent, props?: Record<string, string | number>) {
  if (typeof window === "undefined") return;
  const plausible = (window as unknown as { plausible?: PlausibleFn }).plausible;
  try {
    plausible?.(event, props ? { props } : undefined);
  } catch {
    // Zählung darf nie den Nutzerfluss stören.
  }
}
