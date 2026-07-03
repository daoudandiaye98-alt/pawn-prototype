/**
 * lastSeen — ambient meta about when the user was last present.
 * Not a domain event (that would pollute the log with visitation noise).
 * Persistent only for the return-banner heuristic (M4).
 */
const KEY = "pawn:last-seen";
const CHOICE_KEY = "pawn:first-choice";
const RETURN_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes — demo-friendly

export function readLastSeen(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  return raw ? Number(raw) : null;
}

export function writeLastSeen(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, String(Date.now()));
}

export function isReturningVisit(prev: number | null): boolean {
  if (prev == null) return false;
  return Date.now() - prev > RETURN_THRESHOLD_MS;
}

export function readFirstChoice(): "light" | "shadow" | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(CHOICE_KEY);
  return raw === "light" || raw === "shadow" ? raw : null;
}

export function writeFirstChoice(choice: "light" | "shadow"): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CHOICE_KEY, choice);
}
